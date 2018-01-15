project('adblockpluscore', 'cpp', license: ['GPL3'], meson_version: '>0.40.0')

native = get_option('native')
if native
   target_type='native'
else
   target_type='js'
endif

if target_type == 'js'
  # locate emscripten-config
  python = import('python3').find_python()
  emscripten_config = get_option('emscripten-config')
  command = run_command(python, '-c', 'import os.path, sys;print(os.path.expanduser(sys.argv[1]))', emscripten_config)
  if command.returncode() != 0
    error(command.stderr().strip())
  endif
  emscripten_config = command.stdout().strip()
  message('Emscripten config file: ' + emscripten_config)

  # locate emcc
  command = run_command(python, '-c', 'import sys;exec(open(sys.argv[1]).read());print(EMSCRIPTEN_ROOT)', emscripten_config)
  if command.returncode() != 0
    error(command.stderr().strip())
  endif
  emcc = join_paths(command.stdout().strip(), 'emcc')
  emcc = find_program(emcc)

  # locate node
  command = run_command(python, '-c', 'import sys;exec(open(sys.argv[1]).read());print(NODE_JS)', emscripten_config)
  if command.returncode() != 0
    error(command.stderr().strip())
  endif
  nodejs = find_program(command.stdout().strip(), 'node', 'nodejs')
endif

JS_LIBRARY = files(join_paths('compiled', 'library.js'))
BINDINGS_JS_LIBRARY = files(join_paths('compiled', 'bindings', 'library.js'))
BINDINGS_GENERATOR = 'bindings.cpp.js'
BINDINGS_OUTPUT = 'bindings.js'
COMPILER_OUTPUT = 'compiled.js'
# params for emcc compilation
ADDITIONAL_PARAMS = [ '-O3', '-std=c++1z', '-Wall', '-Werror',
                      '-fno-rtti' ]
if target_type == 'js'
# CXXFLAGS specific to emcc
  ADDITIONAL_PARAMS += [ '-m32', '--memory-init-file', '0',
                         '--emit-symbol-map' ]
else
  ADDITIONAL_PARAMS += [ '-fsanitize=address' ]
endif
# additional params just for core
CORE_PARAMS = [ '-fno-exceptions' ]

DEFINES = []
GENERATION_PARAMS = [
  ['SHELL_FILE', '"' +
   join_paths(meson.source_root(), 'compiled', 'shell.js') +
   '"'],
  ['ASM_JS', '2'],  # "almost asm"
  ['TOTAL_MEMORY', 16*1024*1024],
  ['TOTAL_STACK', 1*1024*1024],
  ['ALLOW_MEMORY_GROWTH', 1],
  ['NO_EXIT_RUNTIME', 1],
  ['NO_DYNAMIC_EXECUTION', 1],
  ['NO_FILESYSTEM', 1],
  ['INVOKE_RUN', 0],
  ['TEXTDECODER', 0],
  ['EXPORTED_RUNTIME_METHODS', '["cwrap", "ccall", "stringToAscii"]']
]


shared_sources = [
  'compiled/bindings/runtime_utils.cpp',
  'compiled/filter/ActiveFilter.cpp',
  'compiled/filter/BlockingFilter.cpp',
  'compiled/filter/CommentFilter.cpp',
  'compiled/filter/ElemHideBase.cpp',
  'compiled/filter/ElemHideEmulationFilter.cpp',
  'compiled/filter/ElemHideException.cpp',
  'compiled/filter/ElemHideFilter.cpp',
  'compiled/filter/Filter.cpp',
  'compiled/filter/InvalidFilter.cpp',
  'compiled/filter/RegExpFilter.cpp',
  'compiled/filter/WhitelistFilter.cpp',
  'compiled/storage/FilterStorage.cpp',
  'compiled/subscription/DownloadableSubscription.cpp',
  'compiled/subscription/Subscription.cpp',
  'compiled/subscription/UserDefinedSubscription.cpp',
]
# sources specific to core
core_sources = [
  'compiled/traceInit.cpp',
]
# sources for the bindings generator
bindings_sources = [
  'compiled/bindings/generator.cpp',
  'compiled/bindings/main.cpp',
]
# native sources
native_sources = [
  'compiled/library.cpp',
  'compiled/Utils.cpp',
]

defines_args = []
foreach define : DEFINES
  defines_args += '-D' + define
endforeach

generation_args = []
foreach param : GENERATION_PARAMS
  generation_args += '-s'
  generation_args += param[0] + '=' + '@0@'.format(param[1])
endforeach

optional_args = []
buildtype = get_option('buildtype')
if buildtype.startswith('debug')
  optional_args += '-DDEBUG'
  optional_args += '-g3'
  if target_type == 'native'
    ADDITIONAL_PARAMS += [ '-fsanitize=address' ]
    LINK_PARAMS = [ '-fsanitize=address' ]
  endif
endif
tracing = get_option('tracing')
if tracing
  optional_args += '--tracing'
endif

compiler_args = defines_args + generation_args + ADDITIONAL_PARAMS

if target_type == 'js'
  # build objects.
  core_objects = []
  bindings_objects = []
  shared_objects = []
  foreach group : ['core', 'bindings', 'shared']
    objects = []
    foreach source_file : get_variable(group + '_sources')
      output_file = source_file.underscorify() + '.o'
      command = [ emcc, '-MD', '-MF', '@DEPFILE@', '-c', '-o', '@OUTPUT@',
                  '@INPUT@' ] + compiler_args
      if group != 'bindings'
        command += CORE_PARAMS + optional_args
      endif
      objects += custom_target(output_file,
                               input: files(source_file),
                               output: output_file,
                               depfile: output_file + '.deps',
                               command: command)
    endforeach
    # Ideally, we would call set_variable() here but that doesn't work
    # with arrays (see
    # https://github.com/mesonbuild/meson/issues/1481). So we have to
    # do this shifting dance instead.
    core_objects = bindings_objects
    bindings_objects = shared_objects
    shared_objects = objects
  endforeach

  # link the binding generator
  bindings_generator = custom_target(BINDINGS_GENERATOR,
                                     input: bindings_objects + shared_objects,
                                     output: BINDINGS_GENERATOR,
                                     depend_files: [ JS_LIBRARY, BINDINGS_JS_LIBRARY ],
                                     command: [
                                       emcc, '-o', '@OUTPUT@',
                                       '--js-library', JS_LIBRARY,
                                       '--js-library', BINDINGS_JS_LIBRARY,
                                       '@INPUT@'
                                     ])
  # run the binding generator
  bindings_output = custom_target(BINDINGS_OUTPUT,
                                  input: bindings_generator,
                                  output: BINDINGS_OUTPUT,
                                  capture: true,
                                  command: [nodejs, '@INPUT@'])
  # link the core
  output_file = join_paths(meson.source_root(), 'lib', COMPILER_OUTPUT)
  compiler_output = custom_target(COMPILER_OUTPUT,
                                  build_by_default: true,
                                  input: core_objects + shared_objects,
                                  output: COMPILER_OUTPUT,
                                  depend_files: [ JS_LIBRARY ],
                                  command: [
                                    emcc, '-o', output_file,
                                    '--post-js', bindings_output,
                                    '--js-library', JS_LIBRARY,
                                    '@INPUT@'
                                  ] + compiler_args + optional_args)
else
  adblockpluscore = library('adblockpluscore', shared_sources,
                            native_sources,
                            cpp_args: ADDITIONAL_PARAMS + CORE_PARAMS,
                            link_args: LINK_PARAMS)
endif

