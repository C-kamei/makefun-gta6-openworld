// shots.js — deterministic scene staging for screenshots (?shot=drive|chase|mission|start).
// Staged frames are kept free of mid-fade toasts and dialogue boxes.
var AU_SHOTS = (function () {
  function param() {
    var m = /[?&]shot=([a-z]+)/.exec(window.location.search || '');
    return m ? m[1] : null;
  }

  function clearTransient(S) {
    S.toasts.length = 0;
    S.dialogue.length = 0;
    S.promptText = '';
  }

  function putInCar(S, x, y, angle, speed) {
    var car = AU_ENT.makeCar(x, y, angle, '#d94f3d', {});
    car.speed = speed;
    S.cars.push(car);
    S.player.inCar = true; S.player.car = car;
    S.player.x = x; S.player.y = y;
  }

  function apply(S, name) {
    if (!name) return false;
    if (name === 'start') {
      S.state = 'title';
      S.hasSave = false;
      clearTransient(S);
      return true;
    }
    S.state = 'play';
    AU_ENT.spawnTraffic(S, 18);
    if (name === 'drive') {
      AU_MISSIONS.startMission(S, 1); // Hot Wheels: garage marker visible
      putInCar(S, 1100, 1200, 0, 260);
      S.wanted = 2; S.cruise = true;
      S.camera.x = 1100 - 640; S.camera.y = 1200 - 400;
      // A few traffic cars ahead on the same road.
      [[1500, 1200, 0], [1750, 1174, 0], [900, 1226, Math.PI]].forEach(function (t) {
        var c = AU_ENT.makeCar(t[0], t[1], t[2], '#3d7dd9', { traffic: true });
        c.speed = 130; S.cars.push(c);
      });
    } else if (name === 'chase') {
      AU_MISSIONS.startMission(S, 1);
      putInCar(S, 1700, 1200, Math.PI, 300);
      S.wanted = 3; S.cruise = true;
      S.camera.x = 1700 - 640; S.camera.y = 1200 - 400;
      [[1980, 1200], [2060, 1174], [2140, 1226]].forEach(function (p) {
        var c = AU_ENT.makeCar(p[0], p[1], Math.PI, '#20242e', { police: true });
        c.speed = 320; S.cars.push(c); S.policeCars.push(c);
      });
    } else if (name === 'mission') {
      AU_MISSIONS.startMission(S, 2); // Plaza Showdown: rivals on the plaza
      S.player.x = 1600; S.player.y = 1350;
      S.player.angle = -Math.PI / 2;
      S.wanted = 1;
      S.camera.x = 1600 - 640; S.camera.y = 1200 - 400;
    } else {
      return false;
    }
    clearTransient(S);
    return true;
  }

  return { param: param, apply: apply };
})();
