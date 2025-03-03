'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let uGranularity = 50;
let vGranularity = 50;

let diffuseTexture, specularTexture, normalTexture;
let textureScale = 1.0;

//Зсув для масштабування, u-v координати точки
let uOffset = 0.0;
let vOffset = 0.0;

//Обробка тиків на клавіатурі
document.addEventListener('keydown', function(event) {
    const step = 0.01;
    switch (event.key) {
        case 's':
            uOffset -= step;
            break;
        case 'w':
            uOffset += step;
            break;
        case 'a':
            vOffset -= step;
            break;
        case 'd':
            vOffset += step;
            break;
        default:
            return;
    }

    //Не виходимо за границю
    if(uOffset > 1)
        uOffset = 1;
    if(vOffset > 1)
        vOffset = 1;
    if(uOffset < 0)
        uOffset = 0;
    if(vOffset < 0)
        vOffset = 0;

    //Оновлення показу координат
    textureShiftUValue.textContent = uOffset.toPrecision(2);
    textureShiftVValue.textContent = vOffset.toPrecision(2);

    //Оновлення поверхні
    let data = {};
    CreateSurfaceData(data);

    //Створення буфера
    surface.BufferData(data.verticesF32, data.normalsF32, data.texCoordsF32, data.indicesU16);
});




//Завантаження текстур
function initTextures() {
    diffuseTexture = LoadTexture('textures/diffuse.jpg');
    specularTexture = LoadTexture('textures/specular.png');
    normalTexture = LoadTexture('textures/normal.png');
}

//Оновлення параметру масштабу текстури
function updateTextureScale() {
    textureScale = parseFloat(document.getElementById("textureScale").value);
    document.getElementById("textureScaleValue").textContent = textureScale;

     //Оновлення поверхні
    let data = {};
    CreateSurfaceData(data);

    //Створення буфера
    surface.BufferData(data.verticesF32, data.normalsF32, data.texCoordsF32, data.indicesU16);
}


//Оновлення даних двох слайдерів,
//що забезпечують можливість контролювати зернистість поверхні в U та V напрямках
function updateGranularity() {
    uGranularity = parseInt(document.getElementById("uGranularity").value);
    vGranularity = parseInt(document.getElementById("vGranularity").value);

    document.getElementById("uGranularityValue").textContent = uGranularity;
    document.getElementById("vGranularityValue").textContent = vGranularity;

    //Оновлення поверхні
    let data = {}
    CreateSurfaceData(data);

    //Створення буфера
    surface.BufferData(data.verticesF32, data.normalsF32, data.texCoordsF32, data.indicesU16);
}



//Освітлення
let lightAngle = 0;
const lightRadius = 10.0;
function updateLightPosition() {
    //"Поворот" світла навколо центру
    lightAngle += 0.005;
    let lightX = lightRadius * Math.cos(lightAngle);
    let lightY = lightRadius * Math.sin(lightAngle);
    return [lightX, lightY, 2];
}



// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTexCoords = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iLightPosition = -1;
    this.iAmbientColor = -1;
    this.iDiffuseColor = -1;
    this.iSpecularColor = -1;
    this.iViewDirection = -1;
    this.iShininess = -1;
    this.iDiffuseTexture = -1;
    this.iSpecularTexture = -1;
    this.iNormalMap = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}




/* 
 *  Draws
 */
function draw() {
    //Колір чистого фону
    gl.clearColor(0.447, 0.58, 0.847, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 6, 1500/500, 3, 25); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);
    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    let modelViewProjection = m4.multiply(projection, matAccum1);

    //Оновлюємо світло в даний момент часу
    const lightPosition = updateLightPosition();
    gl.uniform3fv(shProgram.iLightPosition, lightPosition);

    //direction vector = (0,0,1), по завданню
    gl.uniform3fv(shProgram.iViewDirection, [0, 0, 1]);

    //Параметри освітлення
    gl.uniform3fv(shProgram.iAmbientColor, [0.871, 0.451, 0]);
    gl.uniform3fv(shProgram.iDiffuseColor, [1, 0.714, 0]);
    gl.uniform3fv(shProgram.iSpecularColor, [1.0, 0.0, 0.0]);
    gl.uniform1f(shProgram.iShininess, 10.0);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    surface.Draw();
    //Наступний кадр, для збереження крутіння світла
    requestAnimationFrame(draw);
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    initTextures();

    //Створення шейдерної програми
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    //Зв'язуємо графічний процесор з центральним для всього, що використовуємо
    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTexCoords           = gl.getAttribLocation(prog, "texCoord");
    
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iAmbientColor              = gl.getUniformLocation(prog, "ambientColor");
    shProgram.iDiffuseColor              = gl.getUniformLocation(prog, "diffuseColor");
    shProgram.iSpecularColor             = gl.getUniformLocation(prog, "specularColor");
    shProgram.iViewDirection             = gl.getUniformLocation(prog, "viewDirection");
    shProgram.iShininess                 = gl.getUniformLocation(prog, "shininess");
    shProgram.iDiffuseTexture            = gl.getUniformLocation(prog, "diffuseTexture");
    shProgram.iSpecularTexture           = gl.getUniformLocation(prog, "specularTexture");
    
    //Створюємо дані поверхні
    let data = {};
    CreateSurfaceData(data);

    //Створення буфера
    surface = new Model("RICHMOND'S MINIMAL SURFACE");
    surface.BufferData(data.verticesF32, data.normalsF32, data.texCoordsF32, data.indicesU16);
    gl.enable(gl.DEPTH_TEST);
}




















/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
//Тут беремо шейдери
//І віддаємо компілятору глсл
function createProgram(gl, vShader, fShader) {
    //Вертексний шейдер
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    //Фрагментний (піксельний) шейдер
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    //Додаємо до програми
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    //Шукаємо канвас
    //І контекст вебгл
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    //Ініціюєму гл і трекболротатор
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, 0);

    //Починаємо малювати
    draw();
}
