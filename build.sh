sudo service PiCam stop
git pull
pushd client
npm install
npm run build
popd
pushd server
npm install
npx tsc
sudo service PiCam start
