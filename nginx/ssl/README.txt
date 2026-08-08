# Optional TLS termination at nginx
#
# 1. Place certificate files here:
#    ssl/fullchain.pem
#    ssl/privkey.pem
#
# 2. Uncomment the server block below and merge into api.conf.template
#    OR add this file as nginx/conf.d/api-ssl.conf (without .template)
#    when not using envsubst for SSL paths.
#
# server {
#     listen 443 ssl http2;
#     server_name 3mMile.slash.sa;
#
#     ssl_certificate     /etc/nginx/ssl/fullchain.pem;
#     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
#
#     location / {
#         proxy_pass http://3mMile_api;
#         proxy_http_version 1.1;
#         proxy_set_header Host              $host;
#         proxy_set_header X-Real-IP         $remote_addr;
#         proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#     }
# }
