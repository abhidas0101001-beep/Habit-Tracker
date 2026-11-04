import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Heatmap } from './Heatmap';

const props = {
  endDate: '2026-11-04',
  weekStart: 0 as const,
  palette: 'green' as const,
  label: 'Reading heatmap',
};

describe('<Heatmap>', () => {
  it('draws one cell per day up to the end date', () => {
    const { container } = render(<Heatmap {...props} data={new Map()} />);
    // 52 full weeks + Sun–Wed of the current week.
    expect(container.querySelectorAll('rect.heat-cell')).toHaveLength(52 * 7 + 4);
  });

  it('shades cells by level and labels them for screen readers', () => {
    render(
      <Heatmap
        {...props}
        data={
          new Map([
            ['2026-11-03', 1],
            ['2026-11-02', 0.3],
          ])
        }
      />,
    );
    const done = screen.getByLabelText('Tue, Nov 3 2026: done');
    expect(done).toHaveAttribute('data-level', '4');
    expect(screen.getByLabelText('Mon, Nov 2 2026: 30%')).toHaveAttribute('data-level', '2');
  });

  it('hides days before startDate', () => {
    const { container } = render(<Heatmap {...props} data={new Map()} startDate="2026-11-01" />);
    expect(container.querySelectorAll('rect.heat-cell')).toHaveLength(4);
  });

  it('supports keyboard navigation and activation', async () => {
    const onCellClick = vi.fn();
    render(<Heatmap {...props} data={new Map()} onCellClick={onCellClick} />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toHaveAttribute('data-date', '2026-11-04');
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toHaveAttribute('data-date', '2026-10-28');
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveAttribute('data-date', '2026-10-27');
    await user.keyboard('{Enter}');
    expect(onCellClick).toHaveBeenCalledWith('2026-10-27');
  });

  it('marks unscheduled days as rest days', () => {
    render(<Heatmap {...props} data={new Map()} isScheduled={(d) => d !== '2026-11-01'} />);
    expect(screen.getByLabelText('Sun, Nov 1 2026: not done (rest day)')).toHaveAttribute(
      'opacity',
      '0.4',
    );
  });
});
