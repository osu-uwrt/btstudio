/**
 * Breadcrumb Navigation Component
 *
 * Displays the current navigation path through expanded subtrees.
 * Example: MainTree > Navigation > MovementHandler
 *
 * Users can click on any breadcrumb item to collapse to that level.
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { ExpandedSubtreeLevel } from '../types';
import './BreadcrumbNavigation.css';

interface BreadcrumbNavigationProps {
  /** Current expansion hierarchy */
  hierarchy: ExpandedSubtreeLevel[];
  /** The current active subtree (if any) */
  activeSubtreeId?: string;
  /** Called when user clicks a breadcrumb to navigate to that level */
  onNavigateTo?: (hierarchyDepth: number) => void;
}

const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  hierarchy,
  activeSubtreeId,
  onNavigateTo,
}) => {
  // If we have no hierarchy and no active subtree, don't render
  if (hierarchy.length === 0 && !activeSubtreeId) {
    return null;
  }

  return (
    <div className="breadcrumb-navigation">
      {/* Home / Main tree item */}
      <button
        className={`breadcrumb-item ${hierarchy.length === 0 ? 'active' : ''}`}
        onClick={() => onNavigateTo?.(0)}
        title="Back to main tree"
      >
        <Home size={16} className="breadcrumb-icon" />
        <span className="breadcrumb-label">MainTree</span>
      </button>

      {/* Hierarchy levels */}
      {hierarchy.map((level, index) => (
        <React.Fragment key={`${level.subtreeId}-${index}`}>
          <ChevronRight size={16} className="breadcrumb-separator" />
          <button
            className={`breadcrumb-item ${
              index === hierarchy.length - 1 ? 'active' : ''
            }`}
            onClick={() => onNavigateTo?.(index + 1)}
            title={`Navigate to ${level.subtreeId}`}
          >
            <span className="breadcrumb-label">{level.subtreeId}</span>
          </button>
        </React.Fragment>
      ))}

      {/* Current active subtree (if not already in hierarchy) */}
      {activeSubtreeId &&
        !hierarchy.some((l) => l.subtreeId === activeSubtreeId) && (
          <>
            <ChevronRight size={16} className="breadcrumb-separator" />
            <span className="breadcrumb-item active">
              <span className="breadcrumb-label">{activeSubtreeId}</span>
            </span>
          </>
        )}
    </div>
  );
};

export default BreadcrumbNavigation;
