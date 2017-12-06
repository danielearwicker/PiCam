git add .
git commit -m 'Auto deploy'
git push
ssh pi@drepi3 'cd ~/PiCam && git pull && . build.sh'
