# Compiler definitions
CXX = g++
MPICXX = mpic++
CXXFLAGS = -O2
OMPFLAGS = -fopenmp

# Targets
all: bitonic_mpi bitonic_omp bitonic
bitonic: bitonic.cpp
	$(CXX) $(OMPFLAGS) $(CXXFLAGS) -o bitonic bitonic.cpp

bitonic_omp: bitonic_omp.cpp
	$(CXX) $(CXXFLAGS) $(OMPFLAGS) -o bitonic_omp bitonic_omp.cpp

bitonic_mpi: bitonic_mpi.cpp
	$(MPICXX) $(CXXFLAGS) -o bitonic_mpi bitonic_mpi.cpp

# Run all executables
test: all
	@echo "Running BSserial:"
	@./bitonic
	@echo "Running BSomp:"
	@./bitonic_omp
	@echo "Running BSmpi with mpirun (4 processes):"
	@mpirun --use-hwthread-cpus -np 16 ./bitonic_mpi

# Clean compiled files
clean:
	rm -f bitonic bitonic_omp bitonic_mpi 