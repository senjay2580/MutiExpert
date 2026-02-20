import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { GraphData } from '@/types';
import { EmptyState } from '@/components/composed/empty-state';
import { illustrationPresets } from '@/lib/illustrations';

interface KnowledgeGraphViewProps {
  graphData: GraphData;
  className?: string;
}

export function KnowledgeGraphView({ graphData, className }: KnowledgeGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const isEmpty = !graphData.nodes.length && !graphData.edges.length;

  useEffect(() => {
    if (isEmpty || !containerRef.current) return;

    // Determine if dark mode is active
    const isDark = document.documentElement.classList.contains('dark');

    const labelColor = isDark ? '#e0e0e4' : '#1f2937';
    const edgeColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
    const bgColor = isDark ? '#1a1a1e' : '#fafbfc';

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graphData.nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            color: node.color || '#6366f1',
            docCount: node.document_count,
            // Scale node size: min 24, max 56, based on doc count
            size: Math.max(24, Math.min(56, 24 + node.document_count * 4)),
          },
        })),
        ...graphData.edges.map((edge) => ({
          data: {
            source: edge.source,
            target: edge.target,
            strength: edge.strength,
            relationType: edge.relation_type,
            description: edge.description,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.85,
            label: 'data(label)',
            color: labelColor,
            'font-size': '11px',
            'font-weight': 500,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.3,
            'text-outline-width': 2,
            'text-outline-color': bgColor,
            'overlay-opacity': 0,
            'transition-property': 'width, height, border-width',
            'transition-duration': 200,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node:active, node:selected',
          style: {
            'border-width': 3,
            'border-opacity': 0.6,
            'overlay-opacity': 0,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'edge',
          style: {
            width: (ele: cytoscape.EdgeSingular) =>
              Math.max(1, Math.min(4, ele.data('strength') * 3)),
            'line-color': edgeColor,
            'curve-style': 'bezier',
            opacity: 0.6,
            'overlay-opacity': 0,
            'transition-property': 'opacity, line-color',
            'transition-duration': 200,
          } as unknown as cytoscape.Css.Edge,
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 800,
        fit: true,
        padding: 40,
        nodeRepulsion: () => 6000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 80,
        gravity: 0.25,
        numIter: 1000,
        randomize: true,
      } as cytoscape.CoseLayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
      userPanningEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphData, isEmpty]);

  if (isEmpty) {
    return (
      <div className={className}>
        <EmptyState
          icon="streamline-color:module-puzzle-3"
          illustration={illustrationPresets.emptyGraph}
          title="暂无知识图谱数据"
          description="创建知识库并上传文档后，系统会自动构建知识网络"
          className="py-12"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: 400, width: '100%' }}
    />
  );
}
