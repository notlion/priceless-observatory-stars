const loadJSON = (url) => {
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();
    request.open('GET', url);
    request.responseType = 'json';
    request.onload = () => {
      if (request.status === 200) {
        resolve(request.response);
      } else {
        reject(Error('JSON failed to load:' + request.statusText));
      }
    };
    request.onerror = () => reject(Error('There was a network error.'));
    request.send();
  });
}

const loadImage = (url, onload) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
  });
};
