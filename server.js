let path = require('path')
let express = require('express')
let expressHbs = require('express-handlebars')
let cookieParser = require('cookie-parser')
let bodyParser = require('body-parser')
let routes = require('./routes')
let sio = require('socket.io')
let app = express()
let server = require('http').createServer(app)

/*
 * Setup Database, switched from lean stacks loki.js to SQlite.
 */
let filesystem = require('fs')
let dbFile = 'db.db'
let dbFileExists = filesystem.existsSync(dbFile)
let sqlite3 = require('sqlite3').verbose()
let db = new sqlite3.Database(dbFile)
db.serialize(() => {
  if (!dbFileExists) {
    // First run, db doesn't exist.
    db.run('CREATE TABLE canvas_states (state_id INTEGER PRIMARY KEY, timestamp INTEGER, name TEXT, state TEXT)')
  }
})

/*
 * Setup socket.io server
 */
let io = sio(server)
let newClients = []
io.on('connection', function (client) {
  console.log('Client connected!')
  io.clients(function (error, clients) {
    let i
    let nbrClients = clients.length
    if (error) throw error
    console.log('Number of connected clients:', nbrClients)
    // console.log(io.sockets.connected)
    if (nbrClients > 1) {
      newClients.push(client.id)
      // If we have more than one client, ask oldest client to send canvas to new.
      for (i = 0; i < nbrClients; i++) {
        if (clients[i] !== client.id) {
          console.log('sending request for canvas to ', clients[i])
          io.sockets.connected[clients[i]].emit('canvas:retreive')
        }
      }
    }
  })
  clientEventHandling(client)
})

function clientEventHandling (client) {
  client.on('canvas:for_client', function (state) {
    var clientId = newClients.pop()
    if (clientId) { // If client wrongly gets initalized twice this might be called twice.
      io.sockets.connected[clientId].emit('load', state)
    }
  })
  client.on('disconnect', function () {
    console.log('client disconnect')
  })
  client.on('object:added', function (objAsJson) {
    console.log('A client added an object:', objAsJson)
    this.broadcast.emit('object:added', objAsJson)
  })
  client.on('object:removed', function (objUuid) {
    this.broadcast.emit('object:removed', objUuid)
  })
  client.on('object:modified', function (objAsJson) {
    console.log('A client modfied an object:', objAsJson)
    this.broadcast.emit('object:modified', objAsJson)
  })
  client.on('canvas:clear', function () {
    this.broadcast.emit('canvas:clear')
  })
  client.on('save', function (data, callback) {
    let serializedCanvas = data.state
    let name = data.name
    let timestamp = Math.floor(new Date() / 1000)
    let insertStmnt = db.prepare('INSERT INTO canvas_states (timestamp, name, state) VALUES (?, ?, ?)')
    console.log('client wants to save canvas:', name, serializedCanvas)
    insertStmnt.run(timestamp, name, serializedCanvas, function (err) {
      let id
      if (!err) {
        id = this.lastID // If this was an ES6 arrow function this was the socket object instead. TODO: Read up on why.
        io.sockets.emit('new:save',
          {'state_id': id, 'timestamp': timestamp, 'name': name, 'state': serializedCanvas})
        callback(timestamp)
      } else {
        callback('error!')
      }
    })
  })
  client.on('load', (id) => {
    console.log('client wants to load canvas state with id', id)
    db.get('SELECT state FROM canvas_states WHERE state_id = ?', [id], function (err, row) {
      if (!err) {
        io.sockets.emit('load', row.state)
      } else {
        console.log('Error fetching row from db.')
      }
    })
  })
}

/*
 * Boilerplate from LEAN stack
 */
// settings
app.set('port', process.env.PORT || 3000)
app.set('views', path.join(__dirname, 'views'))

// view engine & main template
app.engine('.hbs', expressHbs({ defaultLayout: 'template', extname: '.hbs' }))
app.set('view engine', '.hbs')

// middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use('/public', express.static('public'))

// db reference for the router
app.use((req, res, next) => { req.db = db; next() })

// router
routes.create(app)

// server
server.listen(app.get('port'), () => {
  console.log('Listening on http://localhost:' + app.get('port'))
})
