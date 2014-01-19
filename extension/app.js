
fileGetContents('inject.js', function(js) { var script   = document.createElement("script");
  script.type  = "text/javascript";
  script.text  = js;
  document.body.appendChild(script);
});

function fileGetContents(filename, cb) {
  xhr = new XMLHttpRequest();
  xhr.open('GET', chrome.extension.getURL(filename), true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 3 || xhr.readState == 4 && xhr.status == 200) {
        cb(xhr.responseText);
    }
  }
  xhr.send();
}