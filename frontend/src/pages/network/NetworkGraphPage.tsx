import { useEffect, useRef, useState } from 'react';
import { Button, Card, Spin, message } from 'antd';
import { ScanOutlined, LoadingOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import cytoscape from 'cytoscape';
import { networkService } from '../../services/networkService';

export default function NetworkGraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const queryClient = useQueryClient();

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['network-graph'],
    queryFn: () => networkService.getGraph(),
  });

  const scanMutation = useMutation({
    mutationFn: networkService.scan,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['network-graph'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      message.success(`扫描完成：发现 ${result.links_created} 条关联，生成 ${result.insights_generated} 条洞察`);
    },
    onError: () => message.error('扫描失败'),
  });

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    if (cyRef.current) cyRef.current.destroy();

    const elements: cytoscape.ElementDefinition[] = [];

    graphData.nodes.forEach((node) => {
      elements.push({
        data: {
          id: node.id,
          label: node.label,
          docCount: node.document_count,
        },
      });
    });

    graphData.edges.forEach((edge, i) => {
      elements.push({
        data: {
          id: `edge-${i}`,
          source: edge.source,
          target: edge.target,
          strength: edge.strength,
          label: `${(edge.strength * 100).toFixed(0)}%`,
        },
      });
    });

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3B82F6',
            'label': 'data(label)',
            'color': '#333',
            'font-size': '12px',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'width': 'mapData(docCount, 0, 20, 30, 60)',
            'height': 'mapData(docCount, 0, 20, 30, 60)',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 'mapData(strength, 0, 1, 1, 6)',
            'line-color': '#94A3B8',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#94A3B8',
            'text-rotation': 'autorotate',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 150,
      },
    });

    return () => { cyRef.current?.destroy(); };
  }, [graphData]);

  const hasData = graphData && graphData.nodes.length > 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">知识网络图</h2>
        <Button
          type="primary"
          icon={scanMutation.isPending ? <LoadingOutlined /> : <ScanOutlined />}
          onClick={() => scanMutation.mutate()}
          loading={scanMutation.isPending}
        >
          扫描关联
        </Button>
      </div>
      <Card className="h-[calc(100vh-220px)]" styles={{ body: { height: '100%', padding: 0 } }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full"><Spin size="large" /></div>
        ) : hasData ? (
          <div ref={containerRef} className="w-full h-full" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            请先添加知识库并上传文档，然后点击"扫描关联"发现跨行业知识连接。
          </div>
        )}
      </Card>
    </div>
  );
}
