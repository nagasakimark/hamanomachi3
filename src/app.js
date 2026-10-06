// Screen router. main.js registers the screens.
export const SCREENS = {};
let current = null;
export const app = {
  async go(name, params = {}) {
    const root = document.getElementById('screen');
    const old = root.firstElementChild;
    if (current?.destroy) current.destroy();
    document.getElementById('overlay').replaceChildren();
    const next = await SCREENS[name](params);
    current = next;
    app.currentName = name; app.currentParams = params;
    next.el.classList.add('screen', 'enter');
    root.append(next.el);
    if (old) {
      old.classList.add('leave');
      setTimeout(() => old.remove(), 260);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => next.el.classList.remove('enter')));
    next.mounted?.();
  },
};
