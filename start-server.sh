#!/bin/bash
cd /tmp
python3 -m http.server 8000 &
echo $! > /tmp/server.pid
