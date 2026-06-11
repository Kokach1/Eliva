import { loadConfig } from './config';

export interface GenerationResult {
  postContent: string;
  hashtags: string[];
}

function getStyleGuidance(style: string): string {
  switch (style) {
    case 'Student Achievement':
      return 'Emphasize learning outcomes, team collaboration, overcoming challenges, student growth, and university/IEEE/club environment.';
    case 'Workshop':
      return 'Focus on knowledge transfer, active participation, key takeaways, audience engagement, and community building.';
    case 'Technical':
      return 'Highlight technologies, system architecture, programming concepts, performance stats, engineering challenges, and technical details.';
    case 'Project Showcase':
      return 'Emphasize problem statement, implementation details, features, repository/demo links, impact, and future enhancements.';
    case 'Professional':
    default:
      return 'Maintain a balanced professional tone, highlighting business value, general insights, lessons learned, and career growth.';
  }
}

export async function generateLinkedInPost(
  description: string,
  style: string
): Promise<GenerationResult> {
  const config = loadConfig();
  const apiKey = config.geminiApiKey;

  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add it in settings.');
  }

  const systemInstruction = `You are an expert LinkedIn content strategist.
Expand short user descriptions into professional, engaging LinkedIn posts.
Maintain authenticity while improving readability and professionalism.
Generate relevant hashtags based on the content.
Do not fabricate achievements. Do not exaggerate participation.
Use a professional tone suitable for students, professionals, IEEE members, developers, engineers, and innovators.

Requirements:
- 100-250 words
- Professional tone
- Natural writing style
- No corporate jargon overload
- Relevant hashtags
- Strong opening line
- Proper paragraph formatting
- Mention learning outcomes if applicable
- Suitable for LinkedIn audience

Style focus:
${getStyleGuidance(style)}`;

  const prompt = `Generate a LinkedIn post based on this description:
"${description}"

Return ONLY a JSON object with this structure:
{
  "postContent": "Your generated post content here...",
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3"]
}

Strict: No markdown wrapping around the JSON, no extra text, return just the raw JSON object.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  try {
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      throw new Error('No content returned from Gemini');
    }
    const parsed = JSON.parse(textResult.trim());
    return {
      postContent: parsed.postContent || '',
      hashtags: parsed.hashtags || []
    };
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', err, data);
    throw new Error('Failed to parse response from Gemini API. Please retry.');
  }
}
