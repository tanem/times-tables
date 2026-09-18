import './style.css';

const app = document.querySelector('#app');
if (app) {
  const main = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = 'Times tables';
  main.append(heading);
  app.append(main);
}
