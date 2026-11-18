// input.js — keyboard + mouse state. ALL keys are lowercased (single-char AND
// named keys like Enter/Escape/ArrowUp), so named keys never silently die.
// rewritten in-session 2026-11-18 for gta6-01 round 2 resubmission
var AU_INPUT = (function () {
  var keys = {};
  var justPressed = {}; // edge-triggered: set on keydown, cleared only by pressed()
  var mouse = { x: 640, y: 400, down: false, clicked: false };
  var canvas = null;

  function keyName(e) { return (e.key || '').toLowerCase(); }

  function init(c) {
    canvas = c;
    window.addEventListener('keydown', function (e) {
      var k = keyName(e);
      if (k === ' ' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === 'tab') e.preventDefault();
      if (!e.repeat) justPressed[k] = true;
      keys[k] = true;
    });
    window.addEventListener('keyup', function (e) { keys[keyName(e)] = false; });
    window.addEventListener('blur', function () { for (var k in keys) keys[k] = false; });
    c.addEventListener('mousemove', function (e) {
      var r = c.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (c.width / r.width);
      mouse.y = (e.clientY - r.top) * (c.height / r.height);
    });
    c.addEventListener('mousedown', function (e) {
      if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    });
    window.addEventListener('mouseup', function () { mouse.down = false; });
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function down(k) { return !!keys[k.toLowerCase()]; }
  function pressed(k) {
    k = k.toLowerCase();
    if (justPressed[k]) { justPressed[k] = false; return true; }
    return false;
  }
  function consumeClick() { var c = mouse.clicked; mouse.clicked = false; return c; }
  function clearTransient() { mouse.clicked = false; }

  return { init: init, down: down, pressed: pressed, mouse: mouse,
    consumeClick: consumeClick, clearTransient: clearTransient };
})();
