import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test } from 'vitest';
import CostEstimatorApp from '@/app/page';

test('ReactFlow Canvas Layout renders correctly', () => {
  render(<CostEstimatorApp />);
  
  // Header text should be visible
  expect(screen.getByText('AWS Cost Estimator')).toBeDefined();
  
  // Services Palette should load
  expect(screen.getByText('Amazon EC2')).toBeDefined();
  expect(screen.getByText('Amazon RDS')).toBeDefined();
});

test('Smart Intake Wizard generates automatic nodes and recalculates total cost', () => {
  render(<CostEstimatorApp />);
  
  // Find the Generate button inside the mock wizard pane
  const applyBtn = screen.getAllByText('Apply Architecture to Canvas')[0];
  expect(applyBtn).toBeDefined();

  // Fire click to auto-generate the 3 backend nodes
  fireEvent.click(applyBtn);
  
  // Verify state recalculated the prices (16.5 + 50.8 + 15.2 = 82.5)
  expect(screen.getByText('$82.50')).toBeDefined();
});
