# PiCam
A very low-tech thing for taking/storing pictures from usb cameras

The server and client parts are largely separate projects.

Currently it assumes you have a USB camera plugged into your Pi and so it has the device name:

    /dev/video0

The UI currently sucks.

## Prerequisites

You need Node on your Pi and [this is a very thorough guide](http://thisdavej.com/beginners-guide-to-installing-node-js-on-a-raspberry-pi/) to get you to that point.

I prefer Raspian Lite to leave as much space as possible for images. Get a good (Samsung) 128 GB 
micro SD card. Put Raspian Lite on it, boot it up and run `raspi-config`. Change the `pi` password
and switch on SSH. Finally get Wifi working by editing this config file:

    sudo nano /etc/wpa_supplicant/wpa_supplicant.conf

And add:

    network={
            ssid="YourNetworkName"
            psk="YourPassword"
    }

If you need the IP address of your Pi, run `ifconfig` and look at the `wlan0` section of the output.

You also need ffmpeg. Again [this guide is very simple](https://github.com/tgogos/rpi_ffmpeg) - you can
basically paste that script into a file and run it.

## Client

In `client`, do:

    npm install
    npx webpack

(If you have an old version of Node, you'll need to `npm install -g npx`.)

The server statically servers the client bundle.

## Server

In `server`, do:

    npm install
    npx tsc

Now you can fire up the server temporarily with:

    node built/server/index.js

And look at `http://<yourserver>:3030`.

To get it running properly (i.e. as a daemon that starts automatically) 
use [forever-service](https://github.com/zapty/forever-service):

    sudo npm install -g forever
    sudo npm install -g forever-service
    cd built/server
    sudo forever-service install PiCam --script index.js

You can now start it with:

    sudo service PiCam start

Or just restart your Pi.
