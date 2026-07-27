import { init } from './modules/main.js';
import { initErrorBoundary } from './error-boundary.js';

initErrorBoundary();
init();
