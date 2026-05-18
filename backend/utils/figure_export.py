import matplotlib
matplotlib.use('Agg')  # non-interactive backend required for production
import matplotlib.pyplot as plt
import io
import base64


def fig_to_base64(fig) -> str:
    """Convert a matplotlib figure to a base64-encoded PNG string."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    buf.seek(0)
    plt.close(fig)
    return base64.b64encode(buf.read()).decode('utf-8')


def setup_plot_style():
    """Apply consistent scientific plot style matching the dark UI theme."""
    plt.style.use('dark_background')
    plt.rcParams.update({
        'figure.facecolor': '#0d1421',
        'axes.facecolor': '#0d1421',
        'axes.edgecolor': '#1a2540',
        'axes.labelcolor': '#94a3b8',
        'xtick.color': '#94a3b8',
        'ytick.color': '#94a3b8',
        'grid.color': '#1a2540',
        'grid.linestyle': '--',
        'grid.alpha': 0.6,
        'text.color': '#f1f5f9',
        'legend.facecolor': '#0d1421',
        'legend.edgecolor': '#1a2540',
        'figure.figsize': (8, 5),
    })
