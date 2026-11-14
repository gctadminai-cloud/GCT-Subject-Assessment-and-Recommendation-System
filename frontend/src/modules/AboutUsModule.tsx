import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import ianPhoto from '../assets/team/ian-gabriel-vega.jpg';
import ninoPhoto from '../assets/team/nino-tolibas.jpg';
import jazperPhoto from '../assets/team/jazper-francisco.jpg';
import markPhoto from '../assets/team/mark-lester-arevalo.jpg';
import myckoPhoto from '../assets/team/mycko-lawrence-zapansa.jpg';
import gctCampusImg from '../assets/campus/gct-campus.jpg';
import bytemeLogo from '../assets/byteme/byteme-logo.png';
import gctLogo from '../assets/campus/gct-logo.png';

export interface DeveloperMember {
  id: string;
  name: string;
  role: string;
  roleBadge: string;
  program: string;
  bio: string;
  responsibilities: string[];
  skills: string[];
  photoUrl: string;
}

// 5 Developer Members
// 01: Ian Gabriel Vega (Project Manager - FIRST)
// 02: Niño Tolibas (Programmer - with official photo)
// 03: Jazper Francisco (UI/UX Designer & Frontend Developer)
// 04: Mark Lester Arevalo (Database Specialist & Backend Architect)
// 05: Mycko Lawrence Zapansa (Systems QA & Technical Documentation)
const MEMBERS: DeveloperMember[] = [
  {
    id: 'dev-1',
    name: 'Ian Gabriel Vega',
    role: 'Project Manager',
    roleBadge: 'Project Manager',
    program: 'Bachelor of Science in Information Technology',
    bio: 'Led end-to-end project planning, roadmap execution, sprint coordination, and overall system quality delivery for the GCT Subject Assessment System.',
    responsibilities: [
      'Overall sprint planning, milestone tracking, and task delegation',
      'Cross-functional team coordination across frontend, backend, and documentation',
      'Project roadmap management and scope alignment',
      'System quality assurance review and milestone presentations'
    ],
    skills: ['Project Management', 'Agile / Scrum', 'System Architecture', 'Quality Delivery', 'Strategic Planning'],
    photoUrl: ianPhoto || '/team/ian-gabriel-vega.jpg'
  },
  {
    id: 'dev-2',
    name: 'Niño Tolibas',
    role: 'Programmer',
    roleBadge: 'Programmer',
    program: 'Bachelor of Science in Information Technology',
    bio: 'Spearheaded the core algorithmic development of the Subject Recommendation System, automated prerequisite dependency validation, and database calculation engines.',
    responsibilities: [
      'Core algorithm development & prerequisite graph traversal',
      'Automated course load recommendation logic',
      'Curriculum data parsing & institutional rules engine',
      'Backend API endpoint integration & algorithm validation'
    ],
    skills: ['Algorithms', 'JavaScript / TypeScript', 'React', 'Node.js', 'Prerequisite Logic'],
    photoUrl: ninoPhoto || '/team/nino-tolibas.jpg'
  },
  {
    id: 'dev-3',
    name: 'Jazper Francisco',
    role: 'UI/UX Designer & Frontend Developer',
    roleBadge: 'UI/UX Designer',
    program: 'Bachelor of Science in Information Technology',
    bio: 'Crafted the visual design system, student recommendation matrices, modern responsive glass layouts, and intuitive registrar user experiences.',
    responsibilities: [
      'User interface design & modern layout styling',
      'Student recommendation result visualization & matrix UI',
      'Responsive dashboard design & interaction flows',
      'Component prototyping & design system standardization'
    ],
    skills: ['UI/UX Design', 'Tailwind / Modern CSS', 'React Components', 'Figma', 'Responsive Design'],
    photoUrl: jazperPhoto || '/team/jazper-francisco.jpg'
  },
  {
    id: 'dev-4',
    name: 'Mark Lester Arevalo',
    role: 'Database Specialist & Backend Architect',
    roleBadge: 'Database Specialist',
    program: 'Bachelor of Science in Information Technology',
    bio: 'Engineered relational database models, Supabase cloud schemas, complex prerequisite queries, and high-performance academic record indexing.',
    responsibilities: [
      'Relational database schema design and curriculum mapping',
      'Row-Level Security (RLS) policies and authentication rules in Supabase',
      'Prerequisite graph querying and automated validation indices',
      'Student academic records data modeling and schema normalization'
    ],
    skills: ['Database Architecture', 'Supabase / PostgreSQL', 'SQL Optimization', 'Schema Modeling', 'API Integration'],
    photoUrl: markPhoto || '/team/mark-lester-arevalo.jpg'
  },
  {
    id: 'dev-5',
    name: 'Mycko Lawrence Zapansa',
    role: 'Systems QA & Technical Documentation Lead',
    roleBadge: 'QA & Documentation Lead',
    program: 'Bachelor of Science in Information Technology',
    bio: 'Authored comprehensive institutional documentation, testing suites, user operational manuals, and performed systematic validation across user roles.',
    responsibilities: [
      'End-to-end functional and regression testing across user roles',
      'Capstone documentation, system flowcharts, and technical specifications',
      'User acceptance testing (UAT) coordination with institutional guidelines',
      'Bug tracking, requirement verification, and compliance validation'
    ],
    skills: ['Quality Assurance', 'Test Case Design', 'Technical Writing', 'User Acceptance Testing', 'System Documentation'],
    photoUrl: myckoPhoto || '/team/mycko-lawrence-zapansa.jpg'
  }
];

export const AboutUsModule: React.FC = () => {
  // null = modal closed; number (0-4) = currently selected developer
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const total = MEMBERS.length;

  // Next and Previous navigation inside the modal
  const handleNext = useCallback(() => {
    setSelectedIdx((prev) => (prev === null ? 0 : (prev + 1) % total));
  }, [total]);

  const handlePrev = useCallback(() => {
    setSelectedIdx((prev) => (prev === null ? 0 : (prev - 1 + total) % total));
  }, [total]);

  // When modal is closed, reset back to initial (0 = Project Manager)
  const handleClose = () => {
    setSelectedIdx(null);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to top when About Us is opened
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
  }, []);

  // Scroll reveal observer: hide muna ang di abot, tapos unti-unti lang lalabas pag nag-scroll down/up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = container.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right');
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          } else {
            entry.target.classList.remove('is-revealed');
          }
        });
      },
      {
        root: null,
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    targets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  // Keyboard navigation when modal is open
  useEffect(() => {
    if (selectedIdx === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx, handleNext, handlePrev]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Staggered letter-by-letter reveal animation for text
  const renderAnimatedLetters = (text: string, baseDelay = 0.1) => {
    return text.split('').map((char, i) => (
      <span
        key={`${char}-${i}`}
        style={{
          display: 'inline-block',
          opacity: 0,
          animation: 'modalLetterReveal 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          animationDelay: `${baseDelay + i * 0.024}s`,
          whiteSpace: char === ' ' ? 'pre' : 'normal'
        }}
      >
        {char}
      </span>
    ));
  };

  const activeMember = selectedIdx !== null ? MEMBERS[selectedIdx] : null;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1240px', margin: '0 auto', paddingBottom: '3.5rem' }}>
      {/* TOP SECTION: GCT CAMPUS HERO BANNER WITH DARK OVERLAY & LEGIBLE SENTENCES */}
      <div className="campus-hero-banner team-header-animated scroll-reveal">
        <img
          src={gctCampusImg}
          alt="Garcia College of Technology Campus"
          className="campus-hero-bg"
        />
        <div className="campus-hero-overlay" />

        <div className="campus-hero-content">
          {/* Grand Heading with Official GCT Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <img
              src={gctLogo}
              alt="Garcia College of Technology Official Logo"
              style={{
                width: '74px',
                height: '74px',
                minWidth: '74px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45))'
              }}
            />
            <div>
              <h1 style={{
                fontSize: '2.6rem',
                fontWeight: 900,
                color: '#FFFFFF',
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: '-0.025em',
                textShadow: '0 3px 12px rgba(0, 0, 0, 0.6)'
              }}>
                Garcia College of Technology
              </h1>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#93C5FD',
                marginTop: '0.3rem',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
              }}>
                GCT AI-Based Subject Assessment & Recommendation System
              </div>
            </div>
          </div>

          {/* Descriptive Sentences with Dark Legible Contrast */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            maxWidth: '920px',
            margin: 0
          }}>
            <p style={{
              fontSize: '0.96rem',
              color: '#F1F5F9',
              lineHeight: 1.65,
              margin: 0,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.65)'
            }}>
              Garcia College of Technology is committed to academic excellence, technological innovation, and holistic student development.
              The GCT AI-Based Subject Assessment & Recommendation System was designed and implemented to modernize collegiate academic advising,
              automate complex prerequisite graph validations across the curriculum, and guide students toward timely and successful degree completion.
            </p>

            <p style={{
              fontSize: '0.96rem',
              color: '#E2E8F0',
              lineHeight: 1.65,
              margin: 0,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.65)'
            }}>
              By integrating intelligent recommendation algorithms with institutional academic policies, the platform empowers students—both regular and irregular—with clear, transparent course planning and personalized subject loads each term. Simultaneously, it equips registrar evaluators and academic advisers with automated eligibility checking, effectively eliminating manual enrollment bottlenecks and ensuring that every student remains on an optimized, achievable pathway toward graduation.
            </p>
          </div>

          {/* 3 Core System Capability Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '0.85rem',
            marginTop: '0.35rem',
            width: '100%'
          }}>
            <div className="scroll-reveal delay-1" style={{
              background: 'rgba(15, 23, 42, 0.68)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              padding: '0.9rem 1.1rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 800, color: '#60A5FA' }}>
                <Cpu size={15} /> Automated Prerequisite Engine
              </div>
              <div style={{ fontSize: '0.76rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                Real-time validation of prerequisite chains and course eligibility across all semesters.
              </div>
            </div>

            <div className="scroll-reveal delay-2" style={{
              background: 'rgba(15, 23, 42, 0.68)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              padding: '0.9rem 1.1rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 800, color: '#60A5FA' }}>
                <Sparkles size={15} /> Intelligent Advising
              </div>
              <div style={{ fontSize: '0.76rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                Automated course load suggestions tailored for regular and irregular student progression.
              </div>
            </div>

            <div className="scroll-reveal delay-3" style={{
              background: 'rgba(15, 23, 42, 0.68)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              padding: '0.9rem 1.1rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 800, color: '#60A5FA' }}>
                <ShieldCheck size={15} /> Registrar Directory
              </div>
              <div style={{ fontSize: '0.76rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                Seamless integration with collegiate curricula, grade records, and academic policies.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 (DIRECTLY BELOW GCT): ABOUT BYTEME DEVELOPER GROUP (50/50 SPLIT: LEFT CONTENT, RIGHT LARGE IMAGE) */}
      <div className="byteme-card-container scroll-reveal">
        {/* LEFTSIDE: BYTEME SENTENCES & STORY (50% WIDTH) */}
        <div className="byteme-text-side scroll-reveal-left">
          {/* Main Title */}
          <div>
            <h3 style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              color: '#0F172A',
              margin: '0 0 0.25rem 0',
              lineHeight: 1.25,
              letterSpacing: '-0.02em'
            }}>
              We are ByteMe
            </h3>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
              GCT AI-Based Subject Assessment & Recommendation System
            </div>
          </div>

          {/* Descriptive Sentences - Personal First-Person Team Introduction */}
          <p style={{
            fontSize: '0.92rem',
            color: '#334155',
            lineHeight: 1.65,
            margin: 0
          }}>
            Hello! We are <strong>ByteMe</strong>, a dedicated group of Information Technology student developers from the Garcia College of Technology College. Driven by our passion for innovation and practical problem-solving, we came together to develop software solutions that make a meaningful impact on our campus community.
          </p>

          <p style={{
            fontSize: '0.92rem',
            color: '#334155',
            lineHeight: 1.65,
            margin: 0
          }}>
            We created the <strong>GCT AI-Based Subject Assessment & Recommendation System</strong> as our capstone project to modernize and simplify academic advising. From formulating automated prerequisite traversal algorithms and engineering high-reliability cloud database schemas, to designing intuitive registrar and student interfaces, every component was carefully crafted by our team to help students navigate their curriculum seamlessly and stay on track toward graduation.
          </p>

          {/* Normal Font Focus Areas */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            marginTop: '0.25rem'
          }}>
            <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>What We Build: </strong>
              We automate multi-level prerequisite logic and course load calculations to eliminate advising bottlenecks.
            </div>

            <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>Why We Build It: </strong>
              We transform complicated evaluation forms into fast, clear, and student-centered digital experiences.
            </div>

            <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>How We Work: </strong>
              We work in close synergy across frontend design, database architecture, and systematic quality assurance.
            </div>
          </div>
        </div>

        {/* RIGHTSIDE: BYTEME LARGE IMAGE (50% WIDTH / KALAHATI ANG IMAGE TULAD SA MODAL) */}
        <div className="byteme-image-side scroll-reveal-right">
          <img
            src={bytemeLogo}
            alt="ByteMe Official Logo"
          />
        </div>
      </div>

      {/* SECTION 3 (AT THE BOTTOM): DEVELOPMENT TEAM (KASYANG-KASYA SA BABA) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* Section Header */}
        <div className="scroll-reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#64748B',
              letterSpacing: '0.18em',
              textTransform: 'uppercase'
            }}>
              DEVELOPMENT TEAM
            </div>
            <h2 style={{
              fontSize: '1.65rem',
              fontWeight: 900,
              color: '#0F172A',
              margin: '0.15rem 0 0 0',
              lineHeight: 1.2
            }}>
              Meet the Developers
            </h2>
            <div style={{
              fontSize: '0.92rem',
              fontWeight: 600,
              color: 'var(--primary)',
              marginTop: '0.25rem'
            }}>
              The dream team of GCT AI-Based Subject Assessment & Recommendation System development.
            </div>
          </div>
        </div>

        {/* 5 COMPACT DEVELOPER CARDS IN A NEAT ROW */}
        <div className="team-grid-strip">
          {MEMBERS.map((m, idx) => {
            const hasPhoto = Boolean(m.photoUrl);
            const initials = getInitials(m.name);

            return (
              <div
                key={m.id}
                className={`team-compact-card scroll-reveal delay-${idx + 1}`}
                onClick={() => setSelectedIdx(idx)}
                title={`Click to view profile of ${m.name}`}
              >
                {/* Image Container */}
                <div className="team-compact-img-wrap">
                  {hasPhoto ? (
                    <img
                      src={m.photoUrl}
                      alt={m.name}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #3B82F6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF'
                      }}
                    >
                      <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '0.05em' }}>
                        {initials}
                      </div>
                    </div>
                  )}
                </div>

                {/* Name at Role Only */}
                <div className="team-compact-info">
                  <h4 className="team-compact-info-name">
                    {m.name}
                  </h4>
                  <div className="team-compact-info-role">
                    {m.role}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED MODAL: LEFT IMAGE, RIGHT INFO (PAG NA-CLICK LALABAS ANG INFO) */}
      {selectedIdx !== null && activeMember && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.25rem',
            backdropFilter: 'blur(6px)'
          }}
        >
          {/* Modal Wrapper with Side Nav Arrows */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
          >
            {/* Left Nav Arrow */}
            <button
              type="button"
              onClick={handlePrev}
              className="team-modal-nav-arrow prev"
              title="Previous Developer"
              aria-label="Previous Developer"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Right Nav Arrow */}
            <button
              type="button"
              onClick={handleNext}
              className="team-modal-nav-arrow next"
              title="Next Developer"
              aria-label="Next Developer"
            >
              <ChevronRight size={24} />
            </button>

            {/* Modal Body Container with Key for Remounting Animations on Next/Prev */}
            <div key={activeMember.id} className="team-modal-container">
              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#F1F5F9',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  transition: 'background 0.2s ease, color 0.2s ease'
                }}
                title="Close and reset to beginning"
              >
                <X size={18} />
              </button>

              {/* LEFT SIDE: IMAGE CONTAINER WITH REVEAL TRANSITION (CLEAN, NO REDUNDANT NAME BADGE) */}
              <div className="team-modal-left">
                <div className="anim-img-sweep" style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {activeMember.photoUrl ? (
                    <img
                      src={activeMember.photoUrl}
                      alt={activeMember.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center 15%',
                        display: 'block'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #3B82F6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        padding: '2rem'
                      }}
                    >
                      <div style={{ fontSize: '5rem', fontWeight: 900, letterSpacing: '0.05em' }}>
                        {getInitials(activeMember.name)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SIDE: DETAILED INFORMATION WITH STAGGERED REVEALS */}
              <div className="team-modal-right">
                {/* Role Badge */}
                <div className="anim-cascade-1">
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    background: '#EFF6FF',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid #BFDBFE'
                  }}>
                    {activeMember.roleBadge}
                  </span>
                </div>

                {/* Name (Letter by Letter Reveal) & Role Header */}
                <div>
                  <h2 style={{
                    fontSize: '1.75rem',
                    fontWeight: 900,
                    color: '#0F172A',
                    margin: '0 0 0.2rem 0',
                    lineHeight: 1.2
                  }}>
                    {renderAnimatedLetters(activeMember.name, 0.1)}
                  </h2>
                  <div className="anim-cascade-2">
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                      {activeMember.role}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                      {activeMember.program} • Garcia College of Technology
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: '#E2E8F0', width: '100%', margin: '0.2rem 0' }} />

                {/* Bio (Cascade 3) */}
                <div className="anim-cascade-3">
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Overview
                  </div>
                  <p style={{
                    fontSize: '0.88rem',
                    color: '#334155',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {activeMember.bio}
                  </p>
                </div>

                {/* Key Contributions (Cascade 4) */}
                <div className="anim-cascade-4">
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Key Contributions & Responsibilities
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {activeMember.responsibilities.map((resp, rIdx) => (
                      <div key={rIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.82rem', color: '#334155', lineHeight: 1.45 }}>
                        <CheckCircle2 size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{resp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills Tags (Cascade 5) */}
                <div className="anim-cascade-5" style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Technologies & Expertise
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {activeMember.skills.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="team-skill-chip"
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          background: '#EFF6FF',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          border: '1px solid #BFDBFE'
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutUsModule;
