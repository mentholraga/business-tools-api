const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
  origin: ['https://mentholraga.github.io', 'http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Business Tools API is running!',
    version: '1.0.0',
    endpoints: [
      'POST /api/swot - Generate SWOT analysis',
      'POST /api/competitor - Analyze competitors (coming soon)',
      'POST /api/personas - Generate customer personas (coming soon)'
    ]
  });
});

// SWOT Analysis endpoint
app.post('/api/swot', async (req, res) => {
  try {
    const { company, industry, additionalContext } = req.body;

    // Validation
    if (!company || company.trim().length === 0) {
      return res.status(400).json({
        error: 'Company name is required'
      });
    }

    if (company.length > 100) {
      return res.status(400).json({
        error: 'Company name too long (max 100 characters)'
      });
    }

    // Create the prompt for OpenAI
    const prompt = `
Conduct a comprehensive SWOT analysis for ${company}${industry ? ` in the ${industry} industry` : ''}${additionalContext ? `. Additional context: ${additionalContext}` : ''}.

Please provide a detailed SWOT analysis with:
- 4-6 key points for each category (Strengths, Weaknesses, Opportunities, Threats)
- Specific, actionable insights rather than generic statements
- Current market context and recent developments
- Focus on strategic implications

Format your response as a JSON object with this exact structure:
{
  "company": "${company}",
  "industry": "${industry || 'Not specified'}",
  "analysis": {
    "strengths": [
      {"point": "Strength title", "description": "Detailed explanation"}
    ],
    "weaknesses": [
      {"point": "Weakness title", "description": "Detailed explanation"}
    ],
    "opportunities": [
      {"point": "Opportunity title", "description": "Detailed explanation"}
    ],
    "threats": [
      {"point": "Threat title", "description": "Detailed explanation"}
    ]
  },
  "keyInsights": [
    "Most critical insight",
    "Second most important insight",
    "Third key strategic point"
  ],
  "recommendations": [
    "Primary strategic recommendation",
    "Secondary recommendation",
    "Risk mitigation suggestion"
  ]
}

Ensure the response is valid JSON only, with no additional text or formatting.`;

    console.log(`SWOT request for: ${company}`);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // More cost-effective than gpt-4
      messages: [
        {
          role: "system",
          content: "You are a strategic business analyst with deep expertise in competitive analysis and market research. Provide thorough, accurate, and actionable SWOT analyses based on current market information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse the JSON response
    let swotAnalysis;
    try {
      swotAnalysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', responseText);
      
      // Fallback: try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        swotAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    // Add metadata
    swotAnalysis.metadata = {
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o-mini',
      version: '1.0.0'
    };

    res.json(swotAnalysis);

  } catch (error) {
    console.error('SWOT Analysis Error:', error);

    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        error: 'API quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before making another request.',
        code: 'RATE_LIMITED'
      });
    }

    res.status(500).json({
      error: 'Failed to generate SWOT analysis. Please try again.',
      code: 'ANALYSIS_FAILED'
    });
  }
});

// Future endpoints placeholder
app.post('/api/competitor', (req, res) => {
  res.status(501).json({
    message: 'Competitor analysis coming soon!',
    status: 'under_development'
  });
});

app.post('/api/personas', (req, res) => {
  res.status(501).json({
    message: 'Customer personas generator coming soon!',
    status: 'under_development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET / - API info',
      'POST /api/swot - SWOT analysis'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Business Tools API running on port ${PORT}`);
  console.log(`📊 Ready to serve SWOT analyses and more!`);
});

module.exports = app;