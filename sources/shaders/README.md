# GLSL Shaders
Shaders use GLSL (OpenGL Shading Language), a special OpenGL Shading Language with syntax similar to C. GLSL is executed directly by the graphics pipeline. There are several kinds of shaders, but two are commonly used to create graphics on the web: Vertex Shaders and Fragment (Pixel) Shaders. Vertex Shaders transform shape positions into 3D drawing coordinates. Fragment Shaders compute the renderings of a shape's colors and other attributes.

GLSL is not as intuitive as JavaScript. GLSL is strongly typed and there is a lot of math involving vectors and matrices. It can get very complicated — very quickly. To speed up the background code we will be using the Three.js API.

From the basic theory in math, a vertex is a point in a 3D coordinate system. Vertices may, and usually do, have additional properties. The 3D coordinate system defines space and the vertices help define shapes in that space.

# Shader types
A shader is essentially a function required to draw something on the screen. Shaders run on a GPU (graphics processing unit), which is optimized for such operations. Using a GPU to deal with shaders offloads some of the number crunching from the CPU. This allows the CPU to focus its processing power on other tasks, like executing code.

**Vertex shaders**

Vertex shaders manipulate coordinates in a 3D space and are called once per vertex. The purpose of the vertex shader is to set up the `gl_Position` variable — this is a special, global, and built-in GLSL variable. `gl_Position` is used to store the position of the current vertex.

The void main() function is a standard way of defining the `gl_Position` variable. Everything inside void main() will be executed by the vertex shader. A vertex shader yields a variable containing how to project a vertex's position in 3D space onto a 2D screen.

**Fragment shaders**

Fragment (or texture) shaders define *RGBA* (red, green, blue, alpha) colors for each pixel being processed — a single fragment shader is called once per pixel. The purpose of the fragment shader is to set up the `gl_FragColor` variable. `gl_FragColor` is a built-in GLSL variable like `gl_Position`.

The calculations result in a variable containing the information about the RGBA color.

Hope that you understand, regardings  **ibra-kdbra**
