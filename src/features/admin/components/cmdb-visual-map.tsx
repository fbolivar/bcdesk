'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const REL_COLORS: Record<string, string> = {
  depends_on: '#EF4444',
  hosts: '#10B981',
  connects_to: '#3B82F6',
  runs_on: '#8B5CF6',
  managed_by: '#F59E0B',
  backs_up: '#06B6D4',
}

const ASSET_COLORS: Record<string, string> = {
  server: '#3B82F6',
  workstation: '#10B981',
  network: '#F59E0B',
  storage: '#8B5CF6',
  application: '#06B6D4',
  service: '#EC4899',
  database: '#EF4444',
  other: '#64748B',
}

interface Asset { id: string; name: string; asset_type: string }
interface Relationship { id: string; source_asset_id: string; target_asset_id: string; relationship_type: string }

interface Props {
  assets: Asset[]
  relationships: Relationship[]
}

export function CmdbVisualMap({ assets, relationships }: Props) {
  const initialNodes: Node[] = useMemo(() =>
    assets.map((a, i) => ({
      id: a.id,
      position: { x: (i % 5) * 220, y: Math.floor(i / 5) * 130 },
      data: { label: a.name, type: a.asset_type },
      style: {
        background: '#1E293B',
        border: `2px solid ${ASSET_COLORS[a.asset_type] ?? '#334155'}`,
        borderRadius: '10px',
        padding: '8px 14px',
        color: '#F1F5F9',
        fontSize: '12px',
        fontWeight: 500,
        minWidth: '130px',
        textAlign: 'center' as const,
      },
    })),
  [assets])

  const initialEdges: Edge[] = useMemo(() =>
    relationships.map(r => ({
      id: r.id,
      source: r.source_asset_id,
      target: r.target_asset_id,
      label: r.relationship_type.replace('_', ' '),
      style: { stroke: REL_COLORS[r.relationship_type] ?? '#64748B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: REL_COLORS[r.relationship_type] ?? '#64748B' },
      labelStyle: { fill: REL_COLORS[r.relationship_type] ?? '#64748B', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: '#0F172A' },
    })),
  [relationships])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const onConnect = useCallback((c: Connection) => setEdges(es => addEdge(c, es)), [setEdges])

  if (assets.length === 0) {
    return (
      <div className="h-96 bg-[#0F172A] rounded-xl border border-[#334155] flex items-center justify-center">
        <p className="text-[#475569] text-sm">Sin activos registrados. Agrega activos en CMDB primero.</p>
      </div>
    )
  }

  return (
    <div className="h-[600px] rounded-xl border border-[#334155] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        style={{ background: '#0F172A' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1E293B" gap={20} />
        <Controls style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }} />
        <MiniMap
          nodeColor={(n) => ASSET_COLORS[(n.data as any).type] ?? '#334155'}
          style={{ background: '#1E293B', border: '1px solid #334155' }}
        />
      </ReactFlow>
    </div>
  )
}
