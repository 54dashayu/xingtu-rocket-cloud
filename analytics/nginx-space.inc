# Included inside space.bh1jss.net TLS server. Analytics service listens on loopback only.
location = /xingtu-admin { return 301 /xingtu-admin/; }
location ^~ /xingtu-admin/ {
    auth_basic "BH1JSS Operations";
    auth_basic_user_file /www/server/nginx/conf/auth/fmolog-stats.htpasswd;
    proxy_set_header X-Xingtu-Admin 1;
    proxy_set_header Host $host;
    proxy_pass http://127.0.0.1:8792/;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header Cache-Control "no-store" always;
    access_log off;
}
location = /xingtu-analytics/event {
    limit_req zone=xingtu_events burst=20 nodelay;
    limit_req_status 429;
    client_max_body_size 2k;
    client_body_timeout 10s;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Xingtu-Admin "";
    proxy_pass http://127.0.0.1:8792/event;
    access_log off;
}
location = /xingtu-analytics/tracker.js {
    proxy_set_header X-Xingtu-Admin "";
    proxy_pass http://127.0.0.1:8792/tracker.js;
    access_log off;
}
location = /xingtu-analytics/privacy {
    proxy_set_header X-Xingtu-Admin "";
    proxy_pass http://127.0.0.1:8792/privacy;
    access_log off;
}
location ^~ /xingtu-analytics/ { return 404; }
