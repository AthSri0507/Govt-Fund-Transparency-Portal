import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'
import lotus from '../assets/lotus.jpg'

export default function Landing() {
  const features = [
    { emoji: '📊', title: 'Track Government Projects', desc: 'See project status, timelines and locations.' },
    { emoji: '💰', title: 'View Fund Usage', desc: 'Understand how public funds are being spent.' },
    { emoji: '🗣', title: 'Submit Feedback', desc: 'Raise concerns or suggestions to authorities.' },
    { emoji: '🛡', title: 'Transparency & Accountability', desc: 'Audit trails and public records for trust.' }
  ]

  const steps = [
    { icon: '🧾', title: 'Register as a citizen', sub: 'Create your citizen account' },
    { icon: '🗺️', title: 'Browse projects', sub: 'Explore public projects on the map' },
    { icon: '📈', title: 'Track spending and milestones', sub: 'Monitor budgets and timelines' },
    { icon: '🗳️', title: 'Submit feedback', sub: 'Share concerns and suggestions' },
    { icon: '🏛️', title: 'Authorities respond', sub: 'Officials review and act' }
  ]

  // trigger staggered reveal of steps when in viewport
  useEffect(() => {
    const stepsEls = Array.from(document.querySelectorAll('.lp-step'))
    if (!stepsEls.length) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target
          const idx = Number(el.getAttribute('data-idx') || 0)
          el.style.transitionDelay = `${idx * 90}ms`
          el.classList.add('in')
          io.unobserve(el)
        }
      })
    }, { threshold: 0.18 })
    stepsEls.forEach(s => io.observe(s))
    return () => io.disconnect()
  }, [])

  return (
    <div className="lp-root">
      <main>
        <section className="lp-hero" style={{ backgroundImage: `url(${lotus})` }}>
          <div className="lp-hero-inner">
            <h2 className="lp-hero-heading">
              <span className="lp-hero-heading-line">Government Fund Transparency</span>
              <span className="lp-hero-heading-line lp-hero-heading-portal">Portal</span>
            </h2>
            <p className="lp-hero-sub">Track public projects. Monitor spending. Raise your voice.</p>
            <div className="lp-hero-actions">
              <a
                href="#features"
                className="btn btn-outline"
                onClick={(e) => { e.preventDefault(); const el = document.getElementById('features'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              >Learn more</a>
              <Link to="/register" className="btn btn-primary">Register as Citizen</Link>
            </div>
          </div>
        </section>

        <section id="features" className="lp-features">
          <div className="lp-container">
            <h3 className="lp-section-title">What this portal does</h3>
            <div className="lp-cards-grid">
              {features.map(f => (
                <div key={f.title} className="lp-card">
                  <div className="lp-card-emoji">{f.emoji}</div>
                  <div className="lp-card-body">
                    <h3 className="lp-card-title">{f.title}</h3>
                    <p className="lp-card-desc">{f.desc}</p>
                  </div>

                  {/* footer: keep a consistent footer area so card bodies align */}
                  <div className="lp-card-footer">
                    {(f.title === 'Track Government Projects' || f.title === 'View Fund Usage') ? (
                      <div className="lp-card-note small-cta">
                        {f.title === 'Track Government Projects'
                          }
                      </div>
                    ) : (
                      <div className="lp-card-note-spacer" aria-hidden />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Join banner moved up: small highlight strip with CTA */}
            <div className="lp-join-banner" aria-hidden>
              <div className="lp-join-inner" style={{ position: 'relative' }}>
                <img src={lotus} alt="" aria-hidden className="lp-join-watermark" />
                <div className="lp-join-left">
                  <h3 className="lp-join-headline">Join the Transparency Movement</h3>
                  <p className="lp-join-sub">Create an account to track public projects and hold authorities accountable.</p>
                </div>
                <div className="lp-join-right">
                  <Link to="/register" className="btn btn-primary btn-join-primary">Register</Link>
                  <Link to="/login" className="btn btn-outline btn-join-secondary">Login</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Removed duplicate large action cards to reduce CTA noise */}

        <section className="lp-steps">
          <div className="lp-page-width">
            <div className="lp-steps-card">
              <h3>How it works</h3>
              <div className="lp-journey">
                <div className="lp-journey-line" aria-hidden></div>
                <ol className="lp-step-list">
                  {steps.map((s, i) => (
                    <li key={s.title} className={`lp-step ${i === 4 ? 'lp-step-complete' : ''}`} data-idx={i}>
                      <span className="lp-step-icon" aria-hidden>{s.icon}</span>
                      <span className="lp-step-num">{i + 1}</span>
                      <div className="lp-step-body">
                        <div className="lp-step-title">{s.title}</div>
                        <div className="lp-step-sub">{s.sub}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-trust">
          <div className="lp-trust-deck">
            <h4><img src={lotus} alt="" className="trust-icon"/> Trust & Authority</h4>
            <p>This official portal enables citizen participation and oversight of public projects, helping ensure funds are used transparently and responsibly.</p>
            <div className="lp-trust-divider" aria-hidden></div>
          </div>
        </section>

        {/* bottom CTA removed to keep hierarchy calm and government-like */}
      </main>

      <footer className="lp-footer">
        <div>R.V College of Engineering</div>
        <div>Maintained by Atharva Srivastava · Yug Shivhare</div>
      </footer>
    </div>
  )
}
