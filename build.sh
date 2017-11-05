git pull
pushd client
echo NOT npm install
npx webpack
popd
pushd server
echo NOT npm install
npx tsc
sudo service PiCam restart
