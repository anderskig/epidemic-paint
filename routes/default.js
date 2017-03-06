let router = require('express').Router()

router.get('/', (req, res) => {
  req.db.all('SELECT * FROM canvas_states', function (err, rows) {
    res.render('default', {
      title: 'Epidemic Draw',
      stored_canvas_states: rows
    })
  })
})

module.exports = router
