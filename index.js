#!/usr/bin/env node

const pm2 = require('pm2')

console.log("OK pm");

pm2.connect(function(err) {
  console.log("started");
  if (err) {
    console.error(err)
    process.exit(2)
  }

  pm2.start({
    script    : 'oa-server.js',
    name      : 'oa-server'
  }, function(err, apps) {
    if (err) {
      console.error(err)
      return pm2.disconnect()
    }

    pm2.list((err, list) => {
      console.log(err, list)

      pm2.restart('api', (err, proc) => {
        // Disconnects from PM2
        pm2.disconnect()
      })
    })
  })
})