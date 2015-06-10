/*jslint devel: true, eqeq: true, sub: true, passfail: true, nomen: true, plusplus: true, maxerr: 1, indent: 2 */
/*global window, document, Image, FileReader */
function MSFU(options) {
  'use strict';

  var debug = true,
    thumbSizes = {width: 150, height: 150},
    supportedFileTypes = ['image/png', 'image/jpeg'],
    checks = {
      dragdrop: (document.createElement('div')).hasOwnProperty('draggable'),
      filereader: !!window.FileReader,
      indexedDB: !!window.indexedDB
    },
    db,
    dbVersion = 1,
    // DOM elements
    $input,
    $dndspot,
    $preview,
    $reset;

  /**
   * Get/Set debug
   */
  this.debug = function (dbg) {
    if (dbg === undefined) {
      return debug;

    }
    debug = !!dbg;

  };

  /**
   * displays error message
   *
   * @param String message
   */
  function errorMessage(message) {
    if (debug) {
      if (window.console) {
        console.error(message);
      } else {
        alert(message);
      }
    }

  }

  /**
   * toggles reset button
   *
   * @param Bool display
   */
  function displayReset(display) {
    if ($reset) {
      $reset.className = display ? '' : 'hidden';
    }

  }

  /**
   * gets dimensions (taking ratio into account)
   *
   * @param Number srcWidth
   * @param Number srcHeight
   * @param Number destWidth
   * @param Number destHeight
   * @returns Object
   */
  function getDimensions(srcWidth, srcHeight, destWidth, destHeight) {
    var w,
      h,
      widthratio = srcWidth / destWidth,
      heightratio = srcHeight / destHeight,
      maxRatio = Math.max(widthratio, heightratio);

    if (maxRatio > 1) {
      w = srcWidth / maxRatio;
      h = srcHeight / maxRatio;
    } else {
      w = srcWidth;
      h = srcHeight;
    }

    return {
      x: (destWidth - w) / 2,
      y: (destHeight - h) / 2,
      width: w,
      height: h
    };

  }

  /**
   * creates app thumbnail
   *
   * @param Image image
   * @param String type (image type)
   * @returns Image
   */
  function createThumbnail(image, type) {

    var canvas = document.createElement('canvas'),
      context = canvas.getContext('2d'),
      thumbnail = new Image(),
      dimensions = getDimensions(image.width, image.height, thumbSizes.width, thumbSizes.height);

    canvas.width = thumbSizes.width;
    canvas.height = thumbSizes.height;

    context.drawImage(image, dimensions.x, dimensions.y, dimensions.width, dimensions.height);

    thumbnail.src = canvas.toDataURL(type, 0.5);

    return thumbnail;

  }

  /**
   * generates files name (used for eg. storage)
   *
   * @param String filetype
   * @returns String
   */
  function generateFileName(filetype) {
    return 'msfu_' + (+new Date()) + Math.floor((Math.random() * 100) + 1) + ':' + filetype;

  }

  /**
   * gets thumbnails previously cached
   *
   * @returns Array
   */
  function getCachedThumbnails(callback) {

    var transaction = db.transaction(['images'], 'readonly'),
      store = transaction.objectStore('images'),
      items = [],
      cursorRequest = store.openCursor();

    cursorRequest.onerror = function (error) {
      errorMessage(error);

    };

    cursorRequest.onsuccess = function (e) {
      var cursor = e.target.result;
      if (cursor) {
        items.push({
          name: cursor.key,
          value: cursor.value
        });
        cursor.continue();
      }

    };

    transaction.oncomplete = function () {
      callback(items);

    };

  }

  /**
   * stores thumbnail in cache
   *
   * @param String name
   * @param String thumb
   */
  function storeThumbnail(name, thumb) {

    if (name && thumb) {
      var transaction = db.transaction(['images'], 'readwrite');
      transaction.objectStore('images').put(thumb, name);
    }

  }

  /**
   * creates thumbnail and appends it to DOM
   *
   * @param Image img
   * @param String type
   */
  function appendThumbnail(img, type) {
    var thumbnail = createThumbnail(img, type),
      link = document.createElement('a');

    link.target = '_blank';
    link.href = img.src;
    link.appendChild(thumbnail);

    // append to DOM
    $preview.appendChild(link);

  }

  /**
   * previews given file
   *
   * @param Object file
   */
  function preview(file) {

    var reader = new FileReader(),
      img;

    reader.onload = function (e) {

      img = new Image();
      img.setAttribute('data-name', generateFileName(file.type));
      img.src = e.target.result;
      img.onload = function () {

        // create and display thumbnail
        appendThumbnail(this, file.type);

        // store
        storeThumbnail(this.getAttribute('data-name'), this.src);

      };


    };

    reader.readAsDataURL(file);

  }

  /**
   * reads files
   */
  function readFiles(files) {

    var i,
      resetButton = false;

    for (i = 0; i < files.length; i++) {
      if (supportedFileTypes.indexOf(files[i].type) >= 0) {
        preview(files[i]);
        resetButton = true;
      } else {
        errorMessage('File type not supported: ' + files[i].type);
      }
    }

    displayReset(resetButton);

  }

  /**
   * Attaches Events to DOM elements
   */
  function attachEvents() {

    $dndspot.ondragover = function () {
      this.className = 'hover';
      return false;

    };

    $dndspot.ondragend = function () {
      this.className = '';
      return false;

    };

    $dndspot.ondragleave = function () {
      this.className = '';
      return false;
    };

    $dndspot.ondrop = function (e) {
      e.preventDefault();
      this.className = '';
      readFiles(e.dataTransfer.files);

    };

    $input.onchange = function () {
      readFiles(this.files);
      this.value = '';

    };

  }

  /**
   * tests features needed to accomplish this task
   */
  function browserSupported() {

    var ret = true;

    if (!checks.filereader) {
      errorMessage('FileReader API not supported');
      ret = false;
    }

    if (!checks.indexedDB) {
      errorMessage('IndexedDB not supported');
      ret = false;
    }

    return ret;

  }

  /**
   * loads thumbnails from browser cache
   */
  function loadFromCache() {

    var i,
      img,
      imgOnload = function () {
        var filetype = this.getAttribute('data-name').split(':')[1];
        // create and display thumbnail
        appendThumbnail(this, filetype);

      };

    getCachedThumbnails(function (cached) {
      if (cached) {


        for (i = 0; i < cached.length; i++) {
          img = new Image();
          img.setAttribute('data-name', cached[i].name);
          img.onload = imgOnload;
          img.src = cached[i].value;

        }

        if (cached.length) {
          displayReset(true);
        }
      }

    });

  }

  function createObjectStore(db) {
    db.createObjectStore('images');

  }

  function initDB() {
    var request = window.indexedDB.open('thumbnails', dbVersion);

    request.onerror = function () {
      errorMessage('Error creating/accessing db');
    };

    request.onsuccess = function () {
      db =  request.result;
      db.onerror = function () {
        errorMessage('Error creating/accessing db');

      };

      if (db.setVersion) {
        if (db.version != dbVersion) {
          var setVersion = db.setVersion(dbVersion);
          setVersion.onsuccess = function () {
            createObjectStore(db);

          };

        }
      }

      // load stored
      loadFromCache();
    };

    request.onupgradeneeded = function (e) {
      createObjectStore(e.target.result);

    };
  }
  /**
   * resets app - clears cache and remove previews
   */
  function reset() {

    window.indexedDB.deleteDatabase('thumbnails');
    initDB();

    while ($preview.lastChild) {
      $preview.removeChild($preview.lastChild);
    }


    displayReset(false);

    return false;

  }

  /**
   * initialization
   *
   * @param Object options
   */
  function init(options) {

    ['dnd', 'input', 'preview'].forEach(function (item) {
      if (!options.hasOwnProperty(item) || !options[item]) {
        throw 'Provide all needed params in options object: dnd, input & preview';
      }

    });

    if (!browserSupported()) {
      errorMessage('Browser not supported.');
      return;

    }

    $dndspot = options.dnd;
    $input = options.input;
    $preview = options.preview;

    if (options.reset) {
      $reset = options.reset;
      $reset.onclick = reset;
    }

    initDB();

    // attach needed events
    attachEvents();


  }

  init(options);

}
