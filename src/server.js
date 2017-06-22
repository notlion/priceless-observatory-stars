#!/usr/local/bin/node

const WebSocket = require('ws');
const readline = require('readline');

const wss = new WebSocket.Server({ port: 8080 });

let connection = null;

wss.on('connection', ws => {
  connection = ws;
});

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => {
  if (connection) {
    connection.send(line);
  }
});
