#!/usr/bin/env bash
# ONE-TIME FIX, run as root on the VPS:  sudo bash fix-port80.sh
#
# Makes nexomessenger.space, www.nexomessenger.space and http://<server-ip>/
# show the REAL NEXO server instead of the old static demo copy: nginx is
# reconfigured to proxy to the Node server on 127.0.0.1:8080. After the HTTP
# proxy works, the script also tries to install/apply a free Let's Encrypt
# certificate with Certbot so https://nexomessenger.space works too (HTTPS
# is also what voice messages and video circles need in the browser).
#
# Previous nginx sites are backed up to /root/nginx-backup-<timestamp> and
# can be restored from there.
set -e

DOMAIN="nexomessenger.space"
WWW_DOMAIN="www.nexomessenger.space"

if [ "$(id -u)" != "0" ]; then
  echo "Run this script as root:  sudo bash fix-port80.sh"
  exit 1
fi

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
cp -a /etc/nginx/sites-available/nexo "/root/nginx-backup-$TS/nexo-site" 2>/dev/null || true
echo "Old nginx sites backed up to /root/nginx-backup-$TS"

rm -f /etc/nginx/sites-enabled/*
cat > /etc/nginx/sites-available/nexo <<NGINX
server {
  listen 80 default_server;
  server_name ${DOMAIN} ${WWW_DOMAIN} _;
  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/nexo /etc/nginx/sites-enabled/nexo

nginx -t
systemctl reload nginx 2>/dev/null || service nginx reload || nginx -s reload

sleep 1
curl -sf http://127.0.0.1/api/health >/dev/null
curl -sf -H "Host: ${DOMAIN}" http://127.0.0.1/api/health >/dev/null
echo ""
echo "HTTP is fixed: http://${DOMAIN}/ now reaches the real NEXO server."

# HTTPS (Let's Encrypt). HTTP already works if this part cannot complete;
# the warning at the end explains what to screenshot/send back.
if ! command -v certbot >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing Certbot for HTTPS..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx || true
  fi
fi

if command -v certbot >/dev/null 2>&1; then
  echo "Requesting HTTPS certificate for ${DOMAIN} and ${WWW_DOMAIN}..."
  if certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
    nginx -t
    systemctl reload nginx 2>/dev/null || service nginx reload || nginx -s reload || true
    if curl -sf "https://${DOMAIN}/api/health" >/dev/null; then
      echo "HTTPS is fixed too: https://${DOMAIN}/ serves the real NEXO server."
    else
      echo "WARNING: certificate was installed, but https://${DOMAIN}/api/health did not answer yet."
      echo "Wait 1-2 minutes and open https://${DOMAIN}/ again."
    fi
  else
    echo "WARNING: Certbot could not finish HTTPS setup. HTTP is fixed, HTTPS is not ready yet."
    echo "Open http://${DOMAIN}/ for now and send a screenshot of this console output."
  fi
else
  echo "WARNING: Certbot is not installed, so HTTPS is not ready yet. HTTP is fixed."
  echo "Open http://${DOMAIN}/ for now and send a screenshot of this console output."
fi

echo ""
echo "Done. Open https://${DOMAIN}/ (or http://${DOMAIN}/ if HTTPS warned above)."
