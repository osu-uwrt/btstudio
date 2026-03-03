/**
 * Vitest global setup.
 *
 * Extends expect() with DOM-specific matchers from @testing-library/jest-dom
 * (e.g. toBeInTheDocument, toHaveTextContent). This file is loaded before
 * every test suite via vitest.config / setupFiles.
 */
import '@testing-library/jest-dom';
