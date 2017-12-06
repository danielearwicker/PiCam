git pull
pushd client
npm install
npm build
popd
pushd server
npm install
npx tsc
sudo service PiCam restart
