# Test Web

Test Web is a web application interface for a Visual Language Model (VLM) designed to evaluate answer sheets. This platform allows teachers and administrators to upload model and student answer sheets, process them through the VLM, and view detailed evaluation results.

## Features

- **File Upload**: Upload model and student answer sheets (images/PDFs).
- **VLM Integration**: Connect to the VLM for automated evaluation of answer sheets.
- **Result Display**: View individual and collective scores.
- **User Authentication**: Secure login for teachers and administrators.
- **Data Management**: Store and manage answer sheets, scores, and student data.

## Project Structure

The project is organized as follows:

```
grade-genius-web/
├── public/               # Static assets (favicon, robots.txt, etc.)
├── src/                  # Source code
│   ├── components/       # Reusable UI components
│   │   ├── auth/         # Authentication components
│   │   ├── dashboard/    # Dashboard components
│   │   ├── layout/       # Layout components
│   │   ├── results/      # Results display components
│   │   ├── ui/           # General UI components (buttons, tables, etc.)
│   │   └── upload/       # File upload components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── pages/            # Application pages (Dashboard, Login, etc.)
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles
├── package.json          # Project dependencies and scripts
├── vite.config.ts        # Vite configuration
└── README.md             # Project documentation
```

## Technologies Used

- **Frontend**: React.js, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js (planned for API integration)
- **Database**: MySQL (planned for data storage)
- **Build Tool**: Vite

## Roadmap

1. Implement file upload functionality.
2. Integrate with the VLM for answer sheet evaluation.
3. Develop result display and reporting features.
4. Add user authentication and role management.
5. Enhance data management and export capabilities.

## Contributing

Contributions to this project are limited to authorized personnel only. If you're part of the development team, please follow internal guidelines for code contributions.

## License

This project is proprietary software. All rights reserved. This software and its associated documentation are confidential and cannot be used, modified, or distributed without explicit permission from the copyright holders.

## Acknowledgments
- The Visual Language Model (VLM) team for providing the evaluation API.
- Open-source libraries and tools used in this project.
