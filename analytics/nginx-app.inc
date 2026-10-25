# Same-origin entry preserves the existing management-page Basic-auth login.
location = /xingtu-admin { return 301 /xingtu-admin/; }
location ^~ /xingtu-admin/ {
    auth_basic "BH1JSS Operations";
    auth_basic_user_file /www/server/nginx/conf/auth/fmolog-stats.htpasswd;
    proxy_ssl_server_name on;
    proxy_ssl_verify on;
    proxy_ssl_verify_depth 3;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_name space.bh1jss.net;
    proxy_set_header Host space.bh1jss.net;
    proxy_set_header Authorization $http_authorization;
    proxy_pass https://space.bh1jss.net/xingtu-admin/;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header Cache-Control "no-store" always;
    access_log off;
}
