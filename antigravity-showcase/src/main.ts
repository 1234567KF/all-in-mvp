import './style.css';
import { initParticles } from './particles';
import { initScrollAnimations } from './scroll';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Get canvas for particles
  const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement;
  if (canvas) {
    initParticles(canvas);
  }

  // Initialize scroll animations
  setTimeout(() => {
    initScrollAnimations();
  }, 100);
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href') as string);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
