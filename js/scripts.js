/* global ID3 */
var Player = {
    filters:null,
    analyser:null
};
var context = null;
Player.init = function(){
    //create context
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    }
    catch(e) {
      alert("Web Audio API не поддерживается в вашем браузере");
    }
    if (typeof window.FileReader === 'undefined') {
      alert("File API и FileReader не поддерживаются в вашем браузере");
    }
};
/**
 * Check if file is audio and load it to buffer
 * @param  {ArrayBuffer object}   arrayBuffer 
 * @param  {Function} callback    
 */
Player.load = function (arrayBuffer,callback) {
    callback.processing();
    context.decodeAudioData(arrayBuffer,function(buffer) {
            callback.success();
            audioBuffer = buffer;
            Player.makeSound();
        }, function(e) {
            callback.error();
    }); 
};
/**
 * Connect all nodes and start playing
 */
Player.makeSound = function(){
    if (this.source) {
        this.source.stop(0);
    }
    if (typeof audioBuffer === 'undefined') {
        return false;
    };
    //create nodes
    this.source = context.createBufferSource();
    this.filters = this.equalizerInit();
    this.analyser = context.createAnalyser();

    //connect nodes
    this.source.connect(this.filters[0]);
    this.filters[this.filters.length - 1].connect(this.analyser);
    this.analyser.connect(context.destination);

    //fill audio buffer
    this.source.buffer = audioBuffer;

    //equaliser
    this.equalize();

    //visualization
    this.visualize();
    
    if (typeof this.source.start !== 'function') {
        this.source.noteOn(0);
    }
    else{
        this.source.start(0);
    }
};
/**
 * Play functionality
 */
Player.play = function(){
    this.stop();
    this.makeSound();
};
/**
 * Stop functionality
 */
Player.stop = function(){
    if (this.source) {
        if (typeof this.source.stop !== 'function') {
            this.source.noteOff(0);
        }
        else{
            this.source.stop(0);
        }
    }
};
/**
 * Waveform visualization processing
 */
Player.visualize = function () {
    var analyser = this.analyser;
    var FF=1200;
    var canvas=document.createElement('canvas');
    var width=canvas.width=FF/2;
    var height=canvas.height=600;
    var canvasCtx=canvas.getContext("2d");
    var canvasContainer = document.getElementById('visualization');
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);
    analyser.fftSize = 2048;
    var bufferLength = analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    animate();
    function animate() {
        canvasCtx.clearRect(0, 0, width, height);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = 'rgba(200, 200, 200, 0)';
        canvasCtx.fillRect(0, 0, width, height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
        canvasCtx.beginPath();
        var sliceWidth = width * 1.0 / bufferLength;
        var x = 0;
        for(var i = 0; i < bufferLength; i++) {
            var v = dataArray[i] / 128.0;
            var y = v * height/2;
            if(i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
        drawVisual = requestAnimationFrame(animate);
    };
    this.analyser = analyser;
};
/**
 * Create 10 band equalizer
 * @return {array} array of Biquad filters for each frequency
 */
Player.equalizerInit = function(){
    var frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    var filters = frequencies.map(function (frequency) {
        var filter = context.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return filter;
    });
    filters.reduce(function (prev, curr) {
      prev.connect(curr);
      return curr;
    });
    return filters;
};
/**
 * Set equalizer preset
 * @param  {string} preset name of preset
 */
Player.equalize = function(preset){
    //store preset
    if (typeof preset !== 'undefined') {
        this.preset=preset;
    };
    var gain = [];
    switch (this.preset) {
        case 'pop':
            gain = [0, 2, 3, 3, 2, 0, 0, 0, 0, 0];
            break
        case 'rock':
            gain = [3, 3, 0, -2, -5, -2, 0, 3, 3, 0];
            break
        case 'jazz':
            gain = [2, 1, 0, -1, -2, -2, 0, 1, 1, 1];
            break
        case 'classic':
            gain = [0, 0, 0, 0, 0, 0, -2, -2, -2, -3];
            break
        default:
            gain = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    if (this.filters) {
        for (var i = 0; i < this.filters.length; i++) {
            this.filters[i].gain.value = gain[i];
        }
    }
};
Player.init();
document.addEventListener('DOMContentLoaded', function() {
    var file;
    var trackMeta = document.getElementById('meta');
    var status = document.getElementById('status');
    var artist = document.getElementById('artist');
    var title = document.getElementById('title');
    var album = document.getElementById('album');
    var year = document.getElementById('year');
    var filenameContainer = document.getElementById('filename-container');
    var loadCallback={
        processing: function(){
            status.className = 'fa fa-circle-o-notch fa-spin';
        },
        success: function(){
            status.className = 'fa fa-check';
            ID3.loadTags(file.name, function() {
                var tags = ID3.getAllTags(file.name);
                trackMeta.style.display = 'block';
                artist.textContent = tags.artist || "";
                title.textContent = tags.title || "";
                album.textContent = tags.album || "";
                year.textContent = tags.year || "";
                var cover = document.getElementById('cover');
                var background = document.getElementById('background');
                if( "picture" in tags ) {
                    var image = tags.picture;
                    var base64String = "";
                    for (var i = 0; i < image.data.length; i++) {
                        base64String += String.fromCharCode(image.data[i]);
                    }
                    var imageUrl = "data:" + image.format + ";base64," + window.btoa(base64String);
                    cover.style.backgroundImage = 'url('+imageUrl+')';
                    background.style.backgroundImage = 'url('+imageUrl+')';
                }
                else{
                    cover.style.backgroundImage = 'url("/img/dummy_cover.jpg")';
                    background.style.backgroundImage = 'none';
                }
            },
            {
                tags: ['artist', 'title', 'album', 'year','track', 'picture'],
                dataReader: FileAPIReader(file)
            });
        },
        error: function(){
            status.className = 'fa fa-exclamation-circle';
            alert("Не удается загрузить данный файл как аудио.");
        }
    };
    //play button
    var playButton = document.getElementById('play-button');
    playButton.addEventListener("click",function(){
        Player.play();
    });
    //stop button
    var stopButton = document.getElementById('stop-button');
    stopButton.addEventListener("click",function(){
        Player.stop();
    });
    //select file
    var fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', function(e) {
        var reader = new FileReader();
        file = e.target.files[0];
        reader.onload = function(e) {
            Player.load(e.target.result,loadCallback);
        };
        reader.readAsArrayBuffer(file);
        filenameContainer.innerHTML = file.name;
    }, false);
    //drop file
    var dropZone = document.getElementById('drop-zone');
    document.body.ondragover = function () {dropZone.style.display = 'block';  return false; };
    dropZone.ondragleave = function () {dropZone.style.display = 'none';  return false; };
    dropZone.ondragend = function () {dropZone.style.display = 'none';  return false; };
    dropZone.addEventListener('drop', function(e){
        dropZone.style.display = 'none';
        e.preventDefault();
        var reader = new FileReader();
        file = e.dataTransfer.files[0];
        reader.onload = function (e) {
          Player.load(e.target.result,loadCallback);
        };
        reader.readAsArrayBuffer(file);
        filenameContainer.innerHTML = file.name;
        return false;
    });
    //equaliser
    var equaliser = document.getElementById('equaliser');
    equaliser.addEventListener('change', function(e){
        Player.equalize(this.value);
    });
});