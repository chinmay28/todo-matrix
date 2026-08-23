import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './app.js';

beforeEach(() => {
  window.localStorage.clear();
});

function matrixCard(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}:`) });
}

describe('App', () => {
  it('shows the four quadrants with zero counts', () => {
    render(<App />);
    expect(matrixCard('Do')).toHaveTextContent('Nothing here');
    expect(matrixCard('Schedule')).toBeInTheDocument();
    expect(matrixCard('Delegate')).toBeInTheDocument();
    expect(matrixCard('Later')).toBeInTheDocument();
  });

  it('adds a task from the global sheet into the quadrant the toggles pick', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await user.type(screen.getByRole('textbox', { name: 'Task title' }), 'File taxes');
    // Defaults: important on, urgent off → Schedule. Turn urgent on → Do.
    expect(screen.getByRole('dialog')).toHaveTextContent('Schedule');
    await user.click(screen.getByRole('button', { name: 'Urgent' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Do');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add task' }));
    expect(matrixCard('Do')).toHaveTextContent('File taxes');
    expect(matrixCard('Do')).toHaveTextContent('1');
  });

  it('quick-adds inside a quadrant and completes a task', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(matrixCard('Schedule'));
    await user.type(screen.getByRole('textbox', { name: 'New task in Schedule' }), 'Plan trip');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Plan trip')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Complete Plan trip' }));
    expect(screen.getByRole('button', { name: /Completed \(1\)/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to matrix' }));
    expect(matrixCard('Schedule')).toHaveTextContent('Nothing here');
  });

  it('moves a task to another quadrant from the task sheet', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(matrixCard('Do'));
    await user.type(screen.getByRole('textbox', { name: 'New task in Do' }), 'Email boss');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await user.click(screen.getByRole('button', { name: 'Edit Email boss' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delegate' }));
    await user.click(screen.getByRole('button', { name: 'Back to matrix' }));
    expect(matrixCard('Do')).toHaveTextContent('Nothing here');
    expect(matrixCard('Delegate')).toHaveTextContent('Email boss');
  });

  it('renames and deletes via the task sheet', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(matrixCard('Later'));
    await user.type(screen.getByRole('textbox', { name: 'New task in Later' }), 'Old idea');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await user.click(screen.getByRole('button', { name: 'Edit Old idea' }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByRole('textbox', { name: 'Task title' });
    await user.clear(input);
    await user.type(input, 'New idea');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.getByText('New idea')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit New idea' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('New idea')).not.toBeInTheDocument();
  });

  it('shows the running version and flashes the developer badge', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Never the literal string — the patch number is the commit count.
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show the developer badge' }));
    expect(screen.getByAltText(/Built by CM Hegday/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByAltText(/Built by CM Hegday/)).not.toBeInTheDocument();
  });

  it('persists tasks across a reload', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(matrixCard('Do'));
    await user.type(screen.getByRole('textbox', { name: 'New task in Do' }), 'Survive reload');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    first.unmount();

    render(<App />);
    expect(matrixCard('Do')).toHaveTextContent('Survive reload');
  });
});
