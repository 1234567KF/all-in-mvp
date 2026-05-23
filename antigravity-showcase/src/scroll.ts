import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initScrollAnimations(): void {
  // Stats section
  gsap.from('#stats .grid > div', {
    y: 60,
    opacity: 0,
    duration: 1,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#stats',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Stage cards
  gsap.from('.stage-card', {
    y: 80,
    opacity: 0,
    duration: 0.8,
    stagger: 0.15,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#stages-content',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Role cards
  gsap.from('.role-card', {
    y: 50,
    opacity: 0,
    duration: 0.6,
    stagger: 0.05,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#roles-content',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Principle cards
  gsap.from('.principle-card', {
    x: (index: number) => index === 0 ? -60 : 60,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#principles-content',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Quality gates
  gsap.from('.quality-gate', {
    y: 40,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#quality-content',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Metric circles animation
  const metricCircles = document.querySelectorAll('.metric-circle');
  metricCircles.forEach((circle) => {
    const target = parseFloat(circle.getAttribute('data-target') || '0');
    gsap.to(circle, {
      strokeDashoffset: 226 - target,
      duration: 1.5,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: circle,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    });
  });

  // Section titles
  const sectionTitles = document.querySelectorAll('.section-title');
  sectionTitles.forEach((title) => {
    gsap.from(title, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: title,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    });
  });
}
