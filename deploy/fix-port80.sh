#!/usr/bin/env bash
# ONE-TIME FIX, run as root on the VPS:  sudo bash fix-port80.sh
# Makes http://<server-ip>/ (port 80) show the REAL NEXO server instead of
# the old static demo copy: nginx is reconfigured to proxy to the Node
# server on 127.0.0.1:8080. Previous nginx sites are backed up to
# /root/nginx-backup-<timestamp> and can be restored from there.
set -e

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed on this server — nothing to fix here."
  echo "The NEXO server can serve port 80 itself via systemd (PORT=80)."
  exit 1
fi

if ! curl -sf http://127.0.0.1:8080/api/health >/dev/null; then
  echo "NEXO Node server is not answering on 127.0.0.1:8080."
  echo "Check it first:  systemctl status nexo   (or: curl http://127.0.0.1:8080/api/health)"
  exit 1
fi

TS=$(date +%s)
mkdir -p "/root/nginx-backup-$TS"
cp -a /etc/nginx/sites-enabled/. "/root/nginx-backup-$TS/" 2>/dev/null || true
echo "Old nginx sites backed up to /root/nginx-backup-$TS"

rm -f /etc/nginx/sites-enabled/*
cat > /etc/nginx/sites-available/nexo <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/nexo /etc/nginx/sites-enabled/nexo

nginx -t
systemctl reload nginx 2>/dev/null || service nginx reload || nginx -s reload

sleep 1
curl -sf http://127.0.0.1/api/health
echo ""
echo "Done. http://<server-ip>/ now serves the real NEXO server."
