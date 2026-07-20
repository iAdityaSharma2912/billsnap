import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Today's sales" value="₹48,250" />)
    expect(screen.getByText("Today's sales")).toBeInTheDocument()
    expect(screen.getByText('₹48,250')).toBeInTheDocument()
  })

  it('renders optional sub text', () => {
    render(<StatCard label="Low stock items" value={3} sub="Needs attention" />)
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
  })
})
