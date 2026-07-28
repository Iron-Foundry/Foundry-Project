FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project --compile-bytecode

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --compile-bytecode

# Icon rendering parallelizes across processes (ProcessPoolExecutor, see
# ingest_icons.py) - without this, numpy's own BLAS backend spins up a thread
# pool *per process* for the vectorized rasterizer ops, oversubscribing the
# CPU and mostly canceling out the process-level parallelism.
ENV OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1

# Python fully block-buffers stdout/stderr when not attached to a TTY (true
# inside a container), so print()/tqdm output sits in a buffer and never
# reaches `docker compose logs` in real time. This forces unbuffered streams.
ENV PYTHONUNBUFFERED=1

# Build provenance for GET /version. Declared after the dependency layers so a
# new commit sha only invalidates this final layer, not the uv sync cache.
ARG GIT_SHA=""
ARG BUILD_TIME=""
ENV GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}

EXPOSE 8100

# Apply pending Alembic migrations before booting so the schema always matches
# the deployed code (a drift here previously crash-looped retention on startup).
# exec keeps gunicorn as the foreground process for correct signal handling.
CMD ["sh", "-c", "uv run alembic upgrade head && exec uv run gunicorn app.api.main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 300 --bind 0.0.0.0:8100"]
