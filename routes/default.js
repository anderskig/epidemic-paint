let router = require('express').Router()

router.get('/', (req, res) => {
  req.db.all('SELECT * FROM canvas_states', function (err, rows) {
    if (err) {
      throw (err)
    }
    res.render('default', {
      title: 'Epidemic Draw',
      stored_canvas_states: rows
    })
  })
})

module.exports = router
