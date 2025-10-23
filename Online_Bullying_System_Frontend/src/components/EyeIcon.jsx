import React from 'react';

const EyeIcon = ({ visible }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M1 12s4.5-7 11-7 11 7 11 7-4.5 7-11 7S1 12 1 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {!visible && (
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

export default EyeIcon;
