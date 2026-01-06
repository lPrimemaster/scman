# Install frontend
yarn run build
cp -r dist/* /var/www/sc1925

# Install backend
cd backend
npm install
mkdir -p /srv/sc1925_backend
cp -r node_modules/ index.js package.json /srv/sc1925_backend
cd ..

chown -R www-data:www-data /srv/sc1925_backend

echo Done!
