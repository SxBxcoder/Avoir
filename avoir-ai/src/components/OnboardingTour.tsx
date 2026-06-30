'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OnboardingTour() {
  useEffect(() => {
    // Only run once per device
    if (localStorage.getItem('avoir_tour_seen')) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: 'Finish',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      popoverClass: 'driver-dark-theme',
      steps: [
        {
          element: '#tour-input-bar',
          popover: {
            title: 'Welcome to Avoir!',
            description: 'Start by typing your campaign goal here. Keep it short or be incredibly detailed—our AI handles both.',
            side: 'top',
            align: 'start',
          }
        },
        {
          element: '#tour-genome-toggle',
          popover: {
            title: 'Campaign Genome Mode',
            description: 'Toggle this to spend 2 credits and generate 3 divergent campaign strategies. You can merge their best traits into one super-campaign.',
            side: 'top',
            align: 'center',
          }
        },
        {
          element: '#tour-omni-deck',
          popover: {
            title: 'Omni-Deck',
            description: 'Once generated, your campaigns are stored here. View, edit, and organize all your marketing assets across channels.',
            side: 'right',
            align: 'start',
          }
        },
        {
          element: '#tour-credits',
          popover: {
            title: 'Your Credits',
            description: 'This is your credit balance. Standard generation costs 1 credit, Genome mode costs 2. Upgrade to Pro for unlimited generation.',
            side: 'bottom',
            align: 'end',
          }
        }
      ],
      onDestroyStarted: () => {
        if (!driverObj.hasNextStep() || confirm('Are you sure you want to skip the tour?')) {
          localStorage.setItem('avoir_tour_seen', 'true');
          driverObj.destroy();
        }
      }
    });

    // Small delay to ensure UI is fully rendered
    const timer = setTimeout(() => {
      driverObj.drive();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
