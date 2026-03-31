import { render, screen } from '@testing-library/react';
import StudentHome from './components/StudentHome';

test('renders the student home page', () => {
  render(<StudentHome />);
  expect(screen.getByText(/online bullying complaint system/i)).toBeInTheDocument();
});
