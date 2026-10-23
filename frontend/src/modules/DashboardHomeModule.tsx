import React from 'react';
import { useRegistrarData } from './RegistrarDataContext';
import {
  Clock,
  PlayCircle,
  Users,
  BarChart3,
  FileCheck,
  CheckCircle2,
  ChevronRight,
  Plus,
  Eye
} from 'lucide-react';

interface DashboardHomeModuleProps {
  onTabChange?: (tab: string) => void;
  onOpenEncodeModal?: () => void;
  onSelectRecStudent?: (studentId: string) => void;
}

export const DashboardHomeModule: React.FC<DashboardHomeModuleProps> = ({
  onTabChange,
  onOpenEncodeModal,
  onSelectRecStudent
}) => {
  const { studentRecommendations, mockStudents } = useRegistrarData();

  return (
    <>
      {/* ROW 1: 4 STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="glass-card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#D97706" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pending Student Signups</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>4</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 700, marginTop: '0.2rem' }}>
                ↑ 2 today <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>awaiting admin check</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlayCircle size={20} color="#1D4ED8" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Recommendation Reviews</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>12</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--info)', fontWeight: 700, marginTop: '0.2rem' }}>
                ↑ 5 today <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>in queue</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} color="#2563EB" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Students Under Records</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{mockStudents.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>
                — Active enrolled
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#E6F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={20} color="#15803D" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reports Generated</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>28</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700, marginTop: '0.2rem' }}>
                ↑ 14% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>this week</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: LINE CHART + DONUT CHART + RECENT STAFF ACTIVITIES */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 4fr 4fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
        {/* Line Chart */}
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Subject Recommendations Processed & Encoded
            </h3>
            <div style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
              This Week ∨
            </div>
          </div>

          <div style={{ height: '210px', position: 'relative', width: '100%' }}>
            <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="staffBlueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="40" x2="500" y2="40" stroke="var(--border-color)" strokeWidth="1" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="var(--border-color)" strokeWidth="1" />
              <line x1="0" y1="140" x2="500" y2="140" stroke="var(--border-color)" strokeWidth="1" />
              <line x1="0" y1="190" x2="500" y2="190" stroke="var(--border-color)" strokeWidth="1" />

              <path
                d="M 20 140 Q 90 110, 160 120 T 300 80 T 440 40 L 440 190 L 20 190 Z"
                fill="url(#staffBlueGradient)"
              />
              <path
                d="M 20 140 Q 90 110, 160 120 T 300 80 T 440 40"
                fill="none"
                stroke="#2563EB"
                strokeWidth="3"
              />
              <circle cx="20" cy="140" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="160" cy="120" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="300" cy="80" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="440" cy="40" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
            <span>May 15</span><span>May 16</span><span>May 17</span><span>May 18</span><span>May 19</span><span>May 20</span><span>May 21</span>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
            My Review Queue Breakdown
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '190px' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border-color)" strokeWidth="16" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#15803D" strokeWidth="16" strokeDasharray="148 238" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1D4ED8" strokeWidth="16" strokeDasharray="60 238" strokeDashoffset="-148" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#D97706" strokeWidth="16" strokeDasharray="30 238" strokeDashoffset="-208" />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>24</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total Queue</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#15803D' }} /> Approved
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', paddingLeft: '0.85rem' }}>15 (62.5%)</div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1D4ED8' }} /> Pending Review
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', paddingLeft: '0.85rem' }}>6 (25.0%)</div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D97706' }} /> Returned
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', paddingLeft: '0.85rem' }}>3 (12.5%)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Activity Feed */}
        <div className="glass-card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
              Staff Operational Logs
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#E6F4EA', padding: '0.35rem', borderRadius: '8px' }}>
                  <FileCheck size={14} color="#15803D" />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Grade encoded for IT 104</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Staff • May 21, 2026 10:45 AM</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#EFF6FF', padding: '0.35rem', borderRadius: '8px' }}>
                  <PlayCircle size={14} color="#1D4ED8" />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Recommendation released</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Staff • May 21, 2026 09:30 AM</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                <div style={{ background: '#EFF6FF', padding: '0.35rem', borderRadius: '8px' }}>
                  <Users size={14} color="#2563EB" />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Student profile verified</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Staff • May 20, 2026 03:15 PM</div>
                </div>
              </div>
            </div>
          </div>

          <a href="#activities" onClick={(e) => { e.preventDefault(); onTabChange?.('home'); }} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.85rem' }}>
            View all activities <ChevronRight size={14} />
          </a>
        </div>
      </div>

      {/* ROW 3: RECENT RECOMMENDATIONS TABLE + STAFF OPERATIONAL HEALTH */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Recent Subject Recommendations Awaiting Review
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Review AI generated prerequisite evaluations for student registration
              </p>
            </div>

            {onOpenEncodeModal && (
              <button
                onClick={onOpenEncodeModal}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} /> Encode Student Grade
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Program & Year</th>
                  <th>Recommended Subjects</th>
                  <th style={{ textAlign: 'center' }}>Total Units</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {studentRecommendations.slice(0, 4).map(rec => (
                  <tr key={rec.studentId}>
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{rec.studentId}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{rec.studentName}</td>
                    <td>
                      <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
                        {rec.program} Yr {rec.yearLevel}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.82rem' }}>
                      {rec.subjects.map(s => s.code).join(', ') || 'No subjects'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>
                      {rec.subjects.reduce((sum, s) => sum + s.totalUnits, 0)} Units
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          if (onSelectRecStudent) onSelectRecStudent(rec.studentId);
                          if (onTabChange) onTabChange('recommendations');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                        title="Review Student Recommendations"
                      >
                        <Eye size={13} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Staff Operational Health Card */}
        <div className="glass-card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
              Operational Health
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  <CheckCircle2 size={15} color="#15803D" /> Grade Sync Engine
                </span>
                <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>Completed</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  <CheckCircle2 size={15} color="#15803D" /> Recommendation Queue
                </span>
                <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>Active</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  <CheckCircle2 size={15} color="#15803D" /> Report Generator
                </span>
                <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>Ready</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  <CheckCircle2 size={15} color="#15803D" /> Audit Log Sync
                </span>
                <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>Enabled</span>
              </div>
            </div>
          </div>

          <a href="#operational-logs" onClick={(e) => { e.preventDefault(); onTabChange?.('recommendations'); }} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '1rem' }}>
            View operational logs <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </>
  );
};
