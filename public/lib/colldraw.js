/*
 * This file uses ES5 syntax for better browser compability
 * Depnds on fabric.js, moment.js, socket.io and commandant.js
 * Linted with eslint standard syntax. I.e. no semi-colon line breaks.
 */

/* lint configuration start */
/* global fabric, io, alert, moment, Commandant */
/* eslint-env browser */
/* lint configuration end */

var tzStr = moment.tz.guess() // Guess client timezone and store it globally

/**
*
* Main 'Class' to create and keep track of collaborative canvas
* Creates a fabric.js canvas with controls and sets up client-server communication on initialization.
*/
var CollDrawCanvas = function () {
  this.socket = io()
  var _this = this
  this.socket.on('connect', function () {
    if (_this.initialized) {
      location.reload() // To not get double canvases on server re-connect (i.e server goes down and up agin).
    } else {
      _this.initCanvas()
      _this.initialized = true
    }
  })
}

/**
 * Intialize canvas and call other intialize functions
 */
CollDrawCanvas.prototype.initCanvas = function () {
  this.canvas = new fabric.Canvas('colldraw-canvas', {
    isDrawingMode: true,
    selection: false // Don't allow selection of more than one object at a time.
  })
  this.container = this.canvas.lowerCanvasEl.parentElement
  // window._canvas = this.canvas // for easier debugging
  this.initControls()
  this.initUndoRedo()
  this.initEvents()
}

/**
 * Initialize event handling that is not related to the canvas Controls.
 * Main event sources are the canvas, 'canvas', it's container 'container'
 * The server communication socket 'socket'
 */
CollDrawCanvas.prototype.initEvents = function () {
  var _this = this
  var handleDrop
  this.stopBroadcast = false // Used when changes made on canvas shoudn't be broadcasted to other clients.

  if (dragAndDropSupported()) {
    /*
     * TODO: Also add eventListeners that makes it possible to drag and drop from within browser,
     * i.e. images from other tabs.
    */
    handleDrop = function (e) {
      var files, file, i, reader
      e.stopPropagation()
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        files = e.dataTransfer.files
        for (i = 0; i < files.length; i++) {
          file = files[i]
          if (file.type.match('image.*')) {
            reader = new FileReader()
            reader.onload = function (evt) {
              var img, imgObj
              // create img element
              img = document.createElement('img')
              img.src = evt.target.result
              // put image on canvas
              imgObj = new fabric.Image(img, {
                width: img.width,
                height: img.height,
                // Set the center of the new object based on the event coordinates relative to the canvas container.
                left: e.layerX,
                top: e.layerY,
                selectable: true
              })
              _this.canvas.add(imgObj)
            }
            // Read in the image file as a data URL.
            reader.readAsDataURL(file)
          }
        }
      }
      this.classList.remove('dropHover')
      return false
    }
    _this.container.addEventListener('dragenter', handleDragEnter, false)
    _this.container.addEventListener('dragover', handleDragOver, false)
    _this.container.addEventListener('dragleave', handleDragLeave, false)
    _this.container.addEventListener('drop', handleDrop, false)
  } else {
    // Could be replaced with a drag and drop library solution.
    alert("This browser doesn't support the HTML5 Drag and Drop API.")
  }

  /*
   * Canvas events.
   */
  this.canvas.on('object:modified', function (e) {
    var object = e.target
    if (!_this.stopBroadcast) {
      _this.socket.emit('object:modified', JSON.stringify(object))
    }
  })

  this.canvas.on('object:added', function (e) {
    var object = e.target
    if (!object.from_server && !_this.stopBroadcast) {
      _this.socket.emit('object:added', JSON.stringify(object))
      if (!object.from_history) {
        _this.historyHandler.execute('ADD_OBJECT', object)
      }
    }
  })

  this.canvas.on('object:removed', function (e) {
    var object = e.target
    if (!object.from_server && !_this.stopBroadcast) {
      _this.socket.emit('object:removed', object.uuid)
    }
  })

  /*
   * Socket events
   */
  this.socket.on('object:added', function (objAsJson) {
    var object = JSON.parse(objAsJson)
    // Fabric has util to recreate fabric Object from serialized string, but we need to treat it as an array
    fabric.util.enlivenObjects([object], function (objects) {
      objects.forEach(function (object) {
        object.from_server = true
        _this.canvas.add(object)
        _this.canvas.renderAll()
      })
    })
  })

  this.socket.on('object:removed', function (objUuid) {
    var object = _this.canvas.getObjectByUuid(objUuid)
    object.from_server = true
    object.remove()
  })

  this.socket.on('object:modified', function (objAsJson) {
    var object = JSON.parse(objAsJson)
    var uuid = object.uuid
    var presentObject = _this.canvas.getObjectByUuid(uuid)
    if (typeof presentObject !== 'undefined') {
      presentObject.set(object)
      _this.canvas.renderAll() // canvas does not auto re-render on object parameter changes.
    }
  })

  this.socket.on('canvas:clear', function () {
    _this.canvas.clear()
  })

  this.socket.on('new:save', function (save) {
    /*
     * Create DOM element mimicing those created by handlebars template on page load.
     * This is a little clunkier than I'd wish, but not worth adding jQuery for.
     */
    var newSaveLi = document.createElement('li')
    var newSaveA = document.createElement('a')
    var newSaveSpan = document.createElement('span')
    var placeholder = $('no-save-placeholder')
    newSaveLi.className = 'dropdown-item load-item'
    newSaveSpan.className = 'date timestamp-to-readable'
    newSaveSpan.innerHTML = readableClientTime(save.timestamp)
    newSaveA.innerHTML = save.name
    newSaveLi.setAttribute('state_id', save.state_id)
    newSaveLi.onclick = loadCanvas
    newSaveLi.appendChild(newSaveA)
    newSaveLi.appendChild(newSaveSpan)
    $('stored-saves-list').appendChild(newSaveLi)
    if (placeholder) {
      placeholder.parentNode.removeChild(placeholder)
    }
  })

  this.socket.on('load', function (serializedCanvas) {
    _this.stopBroadcast = true
    _this.canvas.clear()
    _this.undoButton.disabled = true
    _this.historyHandler.reset()
    _this.canvas.loadFromJSON(serializedCanvas, function () { _this.canvas.renderAll(); _this.stopBroadcast = false })
  })

  this.socket.on('canvas:retreive', function () {
    _this.socket.emit('canvas:for_client', JSON.stringify(_this.canvas))
  })

  this.socket.on('disconnect', function () { console.log('Disconnected from server!') })
  window.onkeyup = function (e) {
    var key = event.which || event.keyCode
    var selectedObject = _this.canvas.getActiveObject()
    if (!selectedObject) return null
    if (key === 46) {
      // Delete
      _this.historyHandler.execute('REMOVE_OBJECT', selectedObject)
    }
  }
}

/**
 * Initalize undo / redo functionality.
 * TODO: Enable undo redo for object modifications as well. This poses some challenges due to how modifications
 * are handled internally in fabric.js and we can only listen to the 'object:modified' event In which we can only get
 * the new values (or change fabric protottype for modifications).
 * Previous values for each object must probably be held in a stack outside of Commandant. Did not have time to implent
 * this.
 */
CollDrawCanvas.prototype.initUndoRedo = function () {
  var _this = this
  var undoButton = $('canvas-undo-button')
  var redoButton = $('canvas-redo-button')
  this.undoButton = undoButton
  this.redoButton = redoButton
  redoButton.disabled = true
  /**
   * Enable or disable undo / redo buttons depending on current Commandant stack stats
   */
  this.disableEnableHistoryButtons = function () {
    var stats = _this.historyHandler.storeStats()
    if (stats.position < stats.length) {
      redoButton.disabled = false
    } else {
      redoButton.disabled = true
    }
    if (stats.position !== 0) {
      undoButton.disabled = false
    } else if (stats.position === 0 && stats.length !== 0) {
      undoButton.disabled = true
    }
  }

  // Create a Commandant scoped to our target
  this.historyHandler = new Commandant(this.canvas)
  // Register our command with the Commandant
  this.historyHandler.register('ADD_OBJECT', {
    init: function (canvas, object) {
      // Object is already added, so init shouldn't do anything.
      return object
    },
    run: function (canvas, object) {
      if (!canvas.getObjectByUuid(object.uuid)) {
        object.from_history = true
        canvas.add(object)
      }
      undoButton.disabled = false // Fixes corner case after load.
      _this.disableEnableHistoryButtons()
    },
    undo: function (canvas, object) {
      object.remove()
      _this.disableEnableHistoryButtons()
    }
  })
  this.historyHandler.register('REMOVE_OBJECT', {
    init: function (canvas, object) {
      return object
    },
    run: function (canvas, object) {
      canvas.remove(object)
      undoButton.disabled = false // Fixes corner case after load.
      _this.disableEnableHistoryButtons()
    },
    undo: function (canvas, object) {
      object.from_history = true
      canvas.add(object)
      _this.disableEnableHistoryButtons()
    }
  })
  undoButton.onclick = function () {
    _this.historyHandler.undo()
  }
  redoButton.onclick = function () {
    _this.historyHandler.redo()
  }
}

/**
 * Initializes canvas controls and sets their event handlers.
 */
CollDrawCanvas.prototype.initControls = function () {
  var _this = this
  var canvas = this.canvas
  var controls = $('canvas-controls')
  var modeSwitcher = $('canvas-mode-button')
  var clear = $('canvas-clear-button')
  var brushSize = $('brush-size')
  var brushColor = $('brush-color')
  var loadItems = document.getElementsByClassName('load-item')
  var dateItems = document.getElementsByClassName('timestamp-to-readable')
  var save = $('save')
  var isDown = false
  var offset, mousePosition
  var i, j, readableTime
  for (j in dateItems) {
    readableTime = readableClientTime(dateItems[j].innerHTML)
    dateItems[j].innerHTML = readableTime
  }

  /*
   * Events
   */
  for (i in loadItems) {
    loadItems[i].onclick = loadCanvas
  }

  brushSize.onkeyup = function () {
    var width = parseInt(this.value, 10) || 1
    canvas.freeDrawingBrush.width = width
  }

  brushColor.onkeyup = function () {
    canvas.freeDrawingBrush.color = this.value
  }

  save.onclick = function () {
    var saveLoader = document.getElementById('save-loader')
    saveLoader.classList.remove('hidden')
    _this.socket.emit('save', {'name': this.previousElementSibling.value, 'state': JSON.stringify(canvas)},
    function (data) {
      // Callback on server done saving.
      var saved = document.getElementById('saved')
      var saveLoader = document.getElementById('save-loader')
      saveLoader.className += ' hidden'
      saved.className += ' save-done'
      setTimeout(function () {
        saved.classList.remove('save-done')
        document.getElementById('save-text').value = ''
      }, 2000)
    })
  }

  clear.onclick = function () {
    _this.socket.emit('canvas:clear')
    var objects = canvas.getObjects().slice() // .slice() to copy array
    _this.historyHandler.captureCompound() // Compound to make it undo / redo as one.
    for (var k = 0; k < objects.length; k++) {
      _this.historyHandler.execute('REMOVE_OBJECT', objects[k])
    }
    _this.historyHandler.finishCompound()
  }

  modeSwitcher.onclick = function () {
    if (canvas.isDrawingMode) {
      _this.undoButton.disabled = true
      _this.redoButton.disabled = true
      canvas.isDrawingMode = false
      this.innerHTML = 'Switch to Drawing Mode'
    } else {
      canvas.isDrawingMode = true
      _this.disableEnableHistoryButtons()
      this.innerHTML = 'Switch to Selection Mode'
    }
  }

  /*
   * Moveable control box
   */
  controls.addEventListener('mousedown', function (e) {
    isDown = true
    offset = [
      controls.offsetLeft - e.clientX,
      controls.offsetTop - e.clientY
    ]
  }, true)
  controls.addEventListener('mouseup', function () {
    isDown = false
  }, true)
  controls.addEventListener('mousemove', function (e) {
    e.preventDefault()
    if (isDown) {
      mousePosition = {
        x: e.clientX,
        y: e.clientY
      }
      controls.style.left = (mousePosition.x + offset[0]) + 'px'
      controls.style.top = (mousePosition.y + offset[1]) + 'px'
    }
  }, true)
}

/*
 Helper functions
 */
/**
* Check if current browser supports Drag and Drop
* @param {String} id - DOM id to select
* @return {Element} DOM element
*/
var $ = function (id) { return document.getElementById(id) } // jQuery style id select.

/**
* Check if current browser supports Drag and Drop
* @return {Bool} drag and drop supported
*/
function dragAndDropSupported () {
  return 'draggable' in document.createElement('span')
}

/**
 * Create universally unique identifer, see http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
 * @return {String} created uuid
 */
function createUuid () {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8) // eslint-disable-line
    return v.toString(16)
  })
}

/**
 * Create readable time string from unix timestamp and guessed browser timezone.
 * @param {String} timestamp - unix timestamp
 * @returns {String} Formatted datetime
 */
function readableClientTime (timestamp) {
  return moment.tz(timestamp * 1000, tzStr).format('MMM Do YYYY HH:mm:ss')
}

/**
 * Loads canvas with state_id equal to attribute of same name.
 */
function loadCanvas () {
  /* Loads canvas of elements with id attribute */
  var stateId = this.getAttribute('state_id')
  window.collDrawCanvas.socket.emit('load', stateId)
}

/*
 * General drag and drop functions
 */
function handleDragOver (e) {
  e.preventDefault() // Necessary. Allows us to drop.
  e.dataTransfer.dropEffect = 'copy' // See the section on the DataTransfer object.
  // NOTE: comment above refers to the article (see top) -natchiketa
  return false
}

function handleDragEnter (e) {
  this.classList.add('dropHover')
}

function handleDragLeave (e) {
  this.classList.remove('dropHover')
}

/*
 * Modify fabric.js Object and Canvas prototypes to handle uuids for objects
 */
fabric.Object.prototype.setOptions = (function (setOptions) {
  // setOptions is called on all object creation. Extend to add uuid to all objects.
  return function (options) {
    setOptions.apply(this, [options])
    if (!this.uuid) {
      // Set uuid if object doesn't have one already (i.e it's remote)
      this.uuid = createUuid()
    }
  }
})(fabric.Object.prototype.setOptions)

fabric.Object.prototype.toObject = (function (toObject) {
  // toObject is called on serialization of objects. Extend to add uuid in included properties.
  return function (propertiesToInclude) {
    propertiesToInclude = (propertiesToInclude || []).concat(['uuid'])
    return toObject.apply(this, [propertiesToInclude])
  }
})(fabric.Object.prototype.toObject)

fabric.Canvas.prototype.getObjectByUuid = function (uuid) {
  var objects = this.getObjects()
  var i
  for (i = 0; i < objects.length; i++) {
    if (objects[i].uuid === uuid) {
      return objects[i]
    }
  }
}

/* Initalize once the DOM is ready */
document.addEventListener('DOMContentLoaded', function (event) {
  window.collDrawCanvas = new CollDrawCanvas()
})
